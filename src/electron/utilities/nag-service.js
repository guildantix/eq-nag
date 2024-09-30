const { ipcRenderer } = require( "electron" );

class ChatRoomOfferModel {

    /** @type {string} */
    PeerId;
    /** @type {string} */
    Offer;

}

class NagService {

    /** @type {string} */
    url;

    constructor() {
        this.url = '';
    }

    async initialize() {
        this.url = await ipcRenderer.invoke( 'get:nag-service-url' );
    }










    /**
     * Handles the response from the server.
     * 
     * @returns Returns the response data.
     * 
     * @param {Response} response The response from the server.
     */
    async #handleResponse( response ) {
        if ( response.status >= 200 && response.status < 300 ) {
            return await response.json();
        } else {
            let error = await response.json();

            if ( error?.ExceptionMessage ) {
                throw new Error( error.ExceptionMessage );
            } else {
                throw new Error( `Server request failed. Status: ${response.status}` );
            }
        }
    }









    
    /**
     * Requests the server to create a chat room.
     * 
     * @returns {Promise<{ChatRoomId: string, PeerId: string}>} The chat room id and the peer id.
     */
    createChatRoom() {
        let url = `${this.url}/chat-room`;
        return fetch( url, {
            method: 'POST',
        } ).then( response => this.#handleResponse( response ) );
    }









    
    /**
     * Requests the server to join a chat room.
     * 
     * @returns {Promise<string>} The peer id.
     * 
     * @param {string} chatRoomId The id of the chatroom.
     */
    joinChatRoom( chatRoomId ) {
        let url = `${this.url}/chat-room/${chatRoomId}/join`;
        return fetch( url, {
            method: 'POST',
        } ).then( async response => this.#handleResponse( response ) );
    }









    
    /**
     * Requests the server to return a list of all peer ids in the chat room.
     * 
     * @returns {Promise<string[]>} The peer ids.
     * 
     * @param {string} chatRoomId The id of the chat room.
     */
    getChatRoomPeers( chatRoomId ) {
        let url = `${this.url}/chat-room/${chatRoomId}/peers`;
        return fetch( url ).then( response => this.#handleResponse( response ) );
    }









    
    /**
     * Returns a list of offers for the specified peer.
     * 
     * @returns {Promise<{PeerId: string, Offer: string, OfferId: string}[]>} The offers.
     * 
     * @param {string} chatRoomId The id of the chat room.
     * @param {string} peerId My peer id.
     */
    getMyOffers( chatRoomId, peerId ) {
        let url = `${this.url}/chat-room/${chatRoomId}/peer/${peerId}/offers`;
        return fetch( url ).then( response => this.#handleResponse( response ) );
    }









    
    /**
     * Posts a new offer to the chatroom.
     * 
     * @returns {Promise<boolean>} True if the offer was posted successfully.
     * 
     * @param {string} chatRoomId The chat room id.
     * @param {string} peerId My peer id.
     * @param {ChatRoomOfferModel} offer The offer.
     */
    postChatRoomOffer( chatRoomId, peerId, offer ) {
        let url = `${this.url}/chat-room/${chatRoomId}/peer/${peerId}/offer`;
        return fetch( url, {
            method: 'POST',
            mode: 'cors', // this cannot be 'no-cors'
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify( {
                "PeerId": offer.PeerId,
                "Offer": offer.Offer,
            } ),
        } ).then( response => response.status === 204 );
    }










    /**
     * Delets the specified chat room peer.
     * 
     * @returns {Promise<boolean>} True if the peer was deleted successfully.
     * 
     * @param {string} chatRoomId The chat room id.
     * @param {string} peerId My peer id.
     */
    deleteChatRoomPeer( chatRoomId, peerId ) {
        let url = `${this.url}/chat-room/${chatRoomId}/peer/${peerId}`;
        return fetch( url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: null,
        } ).then( response => response.status === 204 );
    }










    /**
     * Delets an offer from the chat room.
     * 
     * @returns {Promise<boolean>} True if the offer was deleted successfully.
     * 
     * @param {string} chatRoomId The chat room id.
     * @param {string} peerId My peer id.
     * @param {string} offerId The offer id.
     */
    deleteChatRoomOffer( chatRoomId, peerId, offerId ) {
        let url = `${this.url}/chat-room/${chatRoomId}/peer/${peerId}/offer/${offerId}`;
        return fetch( url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify( offer ),
        } ).then( response => response.status === 204 );
    }

}

module.exports = {
    NagService,
    ChatRoomOfferModel,
};
