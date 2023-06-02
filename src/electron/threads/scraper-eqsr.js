class CharacterClassLevel {
    /** @type {string} */
    class;
    /** @type {number} */
    level;
}

class OutsideResource {

    /** @type {string} */
    url;

    /** @type {string} */
    name;

    /** @type {boolean} */
    selected = false;

}

class ScrapedSpell {

    /** @type {string} */
    name;
    
    /** @type {number} */
    duration;

    /** @type {CharacterClassLevel[]} */
    classes = [];
    
    /** @type {string} */
    castOnOther;
    
    /** @type {string} */
    castOnYou;
    
    /** @type {string} */
    youCast;

    /** @type {number} */
    gemIndex;
    
    /** @type {string} */
    gemSrc;
    
    /** @type {string} */
    targetType;
    
    /** @type {number} The cast time, in milliseconds. */
    castTime;
    
    /** @type {string} */
    effectFades;

    /** @type {OutsideResource[]} */
    itemsWithEffect = [];

    /** @type {any} */
    itemClickOnly = false;

}

/**
 * Scrapes a spell object from the given URL.
 * 
 * @param {string} url The resource url.
 */
function scrapeSpell( url ) {
    let request = new XMLHttpRequest();
    request.addEventListener( 'load', function() {
        let div = document.createElement( 'div' );
        document.body.appendChild( div );
        div.innerHTML = this.responseText;
        
        /** @type {ScrapedSpell} */
        let spell = new ScrapedSpell();

        // let test = document.querySelector('tr')
        let landOnYou = queryContains( 'tr', 'b', 'Land on You', 'td', 1 )?.innerHTML.trim();
        console.log( 'Land on you', landOnYou );
        
        let landOnOther = queryContains( 'tr', 'b', 'Land on Other', 'td', 1 )?.innerHTML.trim();
        console.log( 'Land on Other', landOnOther );
        
        let wearsOff = queryContains( 'tr', 'b', 'Wear off', 'td', 1 )?.innerHTML.trim();
        console.log( 'Wear off', wearsOff );

        let name = document.querySelector( 'title' ).innerText.split( /-/gi )[ 0 ].trim();
        console.log( 'name', name );

        // https://regex101.com/r/IqDrwx/1
        let gemSrc = div.querySelector( 'img[src*="spellicons"]' ).getAttribute( 'src' );
        let gemIndex = /.*\/(?<number>\d+).*/gi.exec( gemSrc ).groups?.number;
        console.log( 'gem', gemSrc, gemIndex );

        let duration = queryContains( 'tr', 'b', 'Duration', 'td', 1 );
        console.log( 'duration', duration );

        // /** @type {HTMLElement} */
        // let spellEmoteSources = document.evaluate( "//td[contains(., 'Land on You') or contains(., 'Land on Other') or contains(., 'Wear off')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext()?.innerHTML.split( '<br>' );
        // /** @type {Record<string, string>} */
        // let spellEmotes = {};
        // for ( let i = 0; i < spellEmoteSources.length; i++ ) {
        //     let emote = spellEmoteSources[ i ].split( ':' );
        //     if ( emote?.length > 1 ) {
        //         spellEmotes[ emote[ 0 ].trim() ] = emote[ 1 ].trim();
        //     }
        // }

        window.api.ipc.sendModel( spell );
    } );
    request.open( 'GET', url );
    request.send();
}

/**
 * 
 * @param {string} domQuery 
 * @param {string} domHasQuery 
 * @param {string} domContainsText 
 * @param {string} childrensQuery 
 * @param {number} childrensIndex 
 * @returns {HTMLElement}
 */
function queryContains( domQuery, domHasQuery, domContainsText, childrensQuery, childrensIndex ) {
    let doms = document.querySelectorAll( domQuery );
    /**
     * 
     * @param {HTMLElement} dom 
     */
    let decideOutput = ( dom ) => {
        if ( childrensQuery ) {
            childrensIndex = childrensIndex > 0 ? childrensIndex : 0;
            return dom.querySelectorAll( childrensQuery )[childrensIndex];
        } else {
            return dom;
        }
    }

    if ( doms?.length > 0 ) {
        let dom = null;
        for ( let i = 0; i < doms.length; i++ ) {
            /** @type {HTMLElement} */
            let hasDom = doms[ i ].querySelector( domHasQuery );

            if ( hasDom ) {
                if ( domContainsText ) {
                    let contains = hasDom.innerHTML?.toLowerCase()?.indexOf( domContainsText?.toLowerCase() ) > -1;
                    if ( contains ) {
                        dom = decideOutput( doms[ i ] );
                    }
                } else {
                    dom = decideOutput( doms[ i ] );
                }
            }

            if ( dom ) {
                break;
            }
        }

        return dom;
    }

    return null;
}
