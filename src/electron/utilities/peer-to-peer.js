const { ipcRenderer } = require( 'electron' );
const Peer = require( 'simple-peer' );
const { NagService } = require( './nag-service' );
const { LogRecord, PlayerEncounterStats } = require( '../data/models/combat-parser' );
const { nagLog, nagException } = require( './nag-console' );

const peerOfferIntervalMs = 6 * 1000;
const p2pVersion = '0.1.2';

/**
 * Sends the given message to the user's server log.
 * 
 * @param {string} message The message to log.
 * @param {undefined | 'red' | 'blue' | 'green' | 'yellow' | 'orange'} color The color of message.
 */
const serverLog = ( message, color ) => {
    ipcRenderer.send( 'chat-room:server-log', {
        message: message,
        color: color,
    } );
}

// Notes:

// If I'm the initiatior, I create the SIGNAL.  I will then go through all the chat room peers and create an offer for each one.

class CreateChatRoomResponseModel {
    
    /** @type {string} */
    chatRoomId;

    /** @type {string} */
    peerId;
    
}

class CombatStatisticsPayloadModel {

    constructor() {
        /** @type {string} */
        this.version = p2pVersion;
    }

    /** @type {string} */
    characterName;
    /** @type {Date} */
    timestamp;
    /** @type {PlayerEncounterStats} */
    encounterStats;
    /** @type {string} */
    encounterId;
}

class CombatEncounterPayloadModel {

    constructor() {
        /** @type {string} */
        this.version = p2pVersion;
    }

    /** @type {string} */
    characterName;
    /** @type {Date} */
    timestamp;
    /** @type {string} */
    encounterId;
    /** @type {string[]} */
    npcs = [];
    /** @type {string[]} */
    logs = [];
}

class HandshakePayloadModel {

    constructor() {
        /** @type {string} */
        this.version = p2pVersion;
    }

    /** @type {string} */
    peerId;
    /** @type {string} */
    characterName;
    /** @type {string} */
    serverName;
}

class GoodbyePayloadModel {
    
    constructor() {
        /** @type {string} */
        this.version = p2pVersion;
    }
    
    /** @type {string} */
    peerId;
    
}

class PeerDataPackageModel {
    /** @type {'message'|'combatStatistics'|'encounter'|'disconnect'|'handshake'|'character'} */
    type;
    /** @type {Date} */
    timestamp;
    /** @type {string} */
    message;
    /** @type {CombatEncounterPayloadModel | CombatStatisticsPayloadModel | HandshakePayloadModel | GoodbyePayloadModel} */
    payload;
}

class LogSync {

    /** @type {NagService} */
    service;

    /** @type {number} */
    #intervalId;

    /** @type {Record<string, PeerDataPackageModel[]>} */
    #data = {};

    /** @type  {Record<string, Peer.Instance>}} */
    #peers = {};

    /** @type  {Record<string, boolean>}} */
    #connectedPeers = {};

    /** @type {(peerId: string) => void} */
    #onPeerConnectedFn = () => { };
    
    /** @type {() => void} */
    #onDataReceivedFn = () => { };

    /** @type {boolean} */
    get connected() {
        return this.chatRoomId != null;
    }

    /** @type {boolean} */
    get hasData() {
        return Object.keys( this.#data ).length > 0;
    }

    /**
     * Initializes a new log sync.
     * 
     * @param {string} character The character name.
     * @param {string} server The server name.
     */
    constructor( character, server ) {
        /** @type {string} */
        this.characterName = character;
        /** @type {string} */
        this.serverName = server;
    }

    /**
     * Changes the character.
     * 
     * @param {string} character The name of the character.
     * @param {string} server The name of the server.
     */
    changeCharacter( character, server ) {
        this.characterName = character;
        this.serverName = server;

        if ( this.connected ) {
            let payload = new HandshakePayloadModel();
            payload.peerId = this.peerId;
            payload.characterName = this.characterName;
            payload.serverName = this.serverName;

            this.sendToAll( {
                type: 'character',
                timestamp: new Date(),
                message: 'Character changed',
                payload: payload,
            } );
        }
    }

    async interval() {
        let offers = await this.service.getMyOffers( this.chatRoomId, this.peerId );

        for ( let offer of offers ) {
            if ( this.#peers[ offer.PeerId ] != undefined ) {
                this.#peers[ offer.PeerId ].signal( offer.Offer );
            } else {
                const peer = this.createPeer( offer.PeerId, offer.Offer, offer.OfferId );
            }
        }
        
    }

    async initialize() {
        this.service = new NagService();
        await this.service.initialize();
    }

    async dispose() {

        if ( this.connected ) {
            let payload = new GoodbyePayloadModel();
            payload.peerId = this.peerId;

            this.sendToAll( {
                type: 'disconnect',
                timestamp: new Date(),
                message: 'Goodbye',
                payload: payload,
            } );

            await this.service.deleteChatRoomPeer( this.chatRoomId, this.peerId );
        }

        this.#intervalId > 0 && window.clearInterval( this.#intervalId );

        if ( this.#peers != undefined ) {
            for ( let peerId in this.#peers ) {
                delete this.#peers[ peerId ];
            }
        }

    }

    async createChatRoom() {
        let data = await this.service.createChatRoom();
        this.chatRoomId = data.ChatRoomId;
        this.peerId = data.PeerId;

        this.#intervalId = window.setInterval( async () => await this.interval(), peerOfferIntervalMs );

        return data.ChatRoomId != undefined && data.PeerId != undefined && this.peerId != undefined && typeof this.peerId == 'string';
    }

    async joinChatRoom( chatRoomId ) {
        try {

            serverLog( `Joining chat room ${chatRoomId}` );
            this.peerId = await this.service.joinChatRoom( chatRoomId );
    
            serverLog( `Joined chat room ${chatRoomId} as ${this.peerId}` );
            let peerIds = await this.service.getChatRoomPeers( chatRoomId );

            serverLog( `Found ${peerIds.length} peers in chat room ${chatRoomId}. ${JSON.stringify( peerIds )}` );
            
            this.chatRoomId = chatRoomId;
    
            for ( let peerId of peerIds ) {
                if ( peerId != this.peerId ) {
                    this.createPeer( peerId );
                }
            }
    
            this.#intervalId = window.setInterval( async () => await this.interval(), 1000 );
    
            return this.peerId != undefined && typeof this.peerId == 'string';
        } catch ( error ) {
            nagException( `(peer-to-peer.js) ${error}` );
            return false;
        }
    }

    async checkForPeers() {
        return await this.service.getMyOffers( this.chatRoomId, this.peerId );
    }

    addPeer( peerId, peer ) {
        this.#peers[ peerId ] = peer;
    }

    removePeer( peerId ) {
        delete this.#peers[ peerId ];
    }

    /**
     * Sends a message to all peers.
     * 
     * @param {PeerDataPackageModel} message The message to send.
     */
    sendToAll( message ) {
        for ( let peerId in this.#peers ) {
            if ( !this.#connectedPeers[ peerId ] ) {
                this.#peers[ peerId ].write( JSON.stringify( message ) );
            } else {
                this.#peers[ peerId ].send( JSON.stringify( message ) );
            }
        }
    }

    /**
     * Returns the data received from the peers, and clears the data.
     */
    flushData() {
        let data = this.#data;
        this.#data = {};
        return data;
    }

    /**
     * Executes the given function on peer connected.
     * 
     * @param {(peerId: string) => void} fn The function to call when a peer is connected.
     */
    onPeerConnected( fn ) {
        if ( fn ) {
            this.#onPeerConnectedFn = fn;
        } else {
            this.#onPeerConnectedFn = () => { };
        }
    }

    onDataReceived( fn ) {
        if ( fn ) {
            this.#onDataReceivedFn = fn;
        } else {
            this.#onDataReceivedFn = () => { };
        }
    }

    /**
     * Sends a message to a peer.
     * 
     * @param {string} peerId The peer id.
     * @param {PeerDataPackageModel} message The message.
     */
    sendToPeer( peerId, message ) {
        if ( this.#peers[ peerId ] != undefined ) {
            if ( !this.#connectedPeers[ peerId ] ) {
                this.#peers[ peerId ].write( JSON.stringify( message ) );
            } else {
                this.#peers[ peerId ].send( JSON.stringify( message ) );
            }
        }
    }

    // Join chat room, find all existing peers, create peer for each one as initator, send offer to each one.
    // When a peer receives an offer, it creates a peer as a receiver and sends an answer back.
    // When a peer receives an answer, it signals the offer and the connection should be complete.

    /**
     * Creates a peer.
     * 
     * @returns Returns the peer.
     * 
     * @param {string} otherPeerId The other peer id.
     * @param {string|undefined} offer The other peer offer.
     * @param {string|undefined} offerId The offer id.
     */
    createPeer( otherPeerId, offer, offerId ) {
        serverLog( `Creating peer to ${otherPeerId}` );
        const peer = new Peer( {
            initiator: offer == undefined,
            trickle: false,
            objectMode: true,
            config: {
                iceServers: [
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun.l.google.com:19302' },
                ]
            },
            // sdpTransform: sdp => sdp,
            // sdpTransform: function (sdp) { return sdp },
        } );

        peer.on( 'signal', data => {
            serverLog( `Received signal from ${otherPeerId}` );
            this.service.postChatRoomOffer( this.chatRoomId, this.peerId, {
                PeerId: otherPeerId,
                Offer: data,
            } );
        } );

        if ( offer != undefined ) {
            peer.signal( offer );
        }

        peer.on( 'connect', () => {
            serverLog( `Connected to ${otherPeerId}` );
            this.#connectedPeers[ otherPeerId ] = true;
            this.#onPeerConnectedFn( otherPeerId );

            let payload = new HandshakePayloadModel();
            
            payload.peerId = this.peerId;
            payload.characterName = this.characterName;
            payload.serverName = this.serverName;
            
            this.sendToPeer( otherPeerId, {
                type: 'handshake',
                timestamp: new Date(),
                message: 'Hello from peer',
                payload: payload,
            } );

        } );

        peer.on( 'data',
            /**
             * Handles data received from the peer.
             * 
             * @param {string} data The data received.
             */
            ( data ) => {
                serverLog( `Data received from ${otherPeerId}` );
                let m = JSON.parse( data );

                this.#data[ otherPeerId ] = this.#data[ otherPeerId ] ?? [];
                this.#data[ otherPeerId ].push( m );

                if ( m?.type == 'disconnect' ) {
                    this.removePeer( otherPeerId );
                }

                this.#onDataReceivedFn();
                
            } );

        peer.on( 'error', error => {
            nagException( `(peer-to-peer.js) ${error}` );
        } );

        this.addPeer( otherPeerId, peer );
        
        serverLog( `Peer created to ${otherPeerId}` );

        return peer;
    }

}

/**
 * Creates a chat room link.
 * 
 * @returns Returns the chat room link.
 * 
 * @param {string} chatRoomId The id of the chat room.
 */
function createChatRoomLink( chatRoomId ) {
    return `{NAG:p2p/${chatRoomId}}`;
}

/**
 * Parses a chat room link and returns the chat room id.
 * 
 * @returns Returns the chat room id.
 * 
 * @param {string} link The chat room link.
 */
function parseChatRoomLink( link ) {
    let match = link.match( /{NAG:p2p\/(.*)}/ );
    return match ? match[ 1 ] : undefined;
}

module.exports = {
    LogSync,
    PeerDataPackageModel,
    CombatStatisticsPayloadModel,
    CombatEncounterPayloadModel,
    HandshakePayloadModel,
    createChatRoomLink,
    parseChatRoomLink,
};
