const { ipcRenderer } = require( 'electron' );
const Peer = require( 'simple-peer' );
const { NagService } = require( './nag-service' );
const { LogRecord, PlayerEncounterStats } = require( '../data/models/combat-parser' );
const { nagLog, nagException } = require( './nag-console' );

const peerOfferIntervalMs = 6 * 1000;

// Notes:

// If I'm the initiatior, I create the SIGNAL.  I will then go through all the chat room peers and create an offer for each one.

class CreateChatRoomResponseModel {
    
    /** @type {string} */
    chatRoomId;

    /** @type {string} */
    peerId;
    
}

class CombatStatisticsPayloadModel {
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
    /** @type {string} */
    characterName;
    /** @type {LogRecord[]} */
    logRecords;
    /** @type {Date} */
    chatTimeStamp;
    /** @type {PlayerEncounterStats} */
    encounterStats;
}

class PeerDataPackageModel {
    /** @type {'message'|'combatStatistics'|'encounter'|'disconnect'} */
    type;
    /** @type {Date} */
    timestamp;
    /** @type {string} */
    message;
    /** @type {CombatEncounterPayloadModel | CombatStatisticsPayloadModel} */
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
    #onPeerConnectedFn = () => {};

    /**
     * Initializes a new log sync.
     */
    constructor() {
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

        this.sendToAll( {
            type: 'disconnect',
            timestamp: new Date(),
            message: 'Goodbye',
            payload: {
                peerId: this.peerId,
            },
        } );
        
        window.clearInterval( this.#intervalId );

        for ( let peerId in this.#peers ) {
            delete this.#peers[ peerId ];
        }

        await this.service.deleteChatRoomPeer( this.chatRoomId, this.peerId );
    }

    async createChatRoom() {
        let data = await this.service.createChatRoom();
        this.chatRoomId = data.ChatRoomId;
        this.peerId = data.PeerId;

        this.#intervalId = window.setInterval( async () => await this.interval(), peerOfferIntervalMs );

        return data.ChatRoomId != undefined && data.PeerId != undefined;
    }

    async joinChatRoom( chatRoomId ) {
        this.chatRoomId = chatRoomId;
        this.peerId = await this.service.joinChatRoom( chatRoomId );

        let peerIds = await this.service.getChatRoomPeers( chatRoomId );

        for ( let peerId of peerIds ) {
            if ( peerId != this.peerId ) {
                this.createPeer( peerId );
            }
        }

        this.#intervalId = window.setInterval( async () => await this.interval(), 1000 );

        return this.peerId != undefined;
    }

    async checkForPeers() {
        return await this.service.getMyOffers( this.chatRoomId, this.peerId );
    }

    addPeer( peerId, peer ) {
        this.#peers[ peerId ] = peer;
    }

    removePeer( peerId ) {
        nagLog( `REMOVING PEER ${peerId}` );
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
    //      Need an internval here to constantly check for new peer offers.
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
        const peer = new Peer( {
            initiator: offer == undefined,
            trickle: false,
            objectMode: true,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                ]
            },
            // sdpTransform: sdp => sdp,
            // sdpTransform: function (sdp) { return sdp },
        } );

        peer.on( 'signal', data => {
            this.service.postChatRoomOffer( this.chatRoomId, this.peerId, {
                PeerId: otherPeerId,
                Offer: data,
            } );
        } );

        if ( offer != undefined ) {
            peer.signal( offer );
        }

        peer.on( 'connect', () => {
            this.#connectedPeers[ otherPeerId ] = true;
            this.#onPeerConnectedFn( otherPeerId );

            nagLog( `PEER CONNECTED ${otherPeerId}` );
            
            this.sendToPeer( otherPeerId, {
                type: 'message',
                timestamp: new Date(),
                message: 'Hello from peer',
                payload: {
                    peerId: this.peerId,
                },
            } );

        } );

        peer.on( 'data',
            /**
             * Handles data received from the peer.
             * 
             * @param {string} data The data received.
             */
            ( data ) => {
                let m = JSON.parse( data );

                if ( m?.type == 'disconnect' ) {
                    this.removePeer( otherPeerId );

                } else {
                    this.#data[ otherPeerId ] = this.#data[ otherPeerId ] ?? [];
                    this.#data[ otherPeerId ].push( m );

                }
            } );

        peer.on( 'error', error => {
            nagException( `(peer-to-peer.js) ${error}` );
        } );

        this.addPeer( otherPeerId, peer );

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
    return link.match( /{NAG:p2p\/(.*)}/ )[1];
}

module.exports = {
    LogSync,
    PeerDataPackageModel,
    CombatStatisticsPayloadModel,
    createChatRoomLink,
    parseChatRoomLink,
};
