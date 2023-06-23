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

class ScrapedClickEffect {

    /** @type {string} */
    name;

    /** @type {number} The cast time, in milliseconds. */
    castTime;

    /** @type {CharacterClassLevel[]} */
    classes;

}

const classTransformer = {
    'bard': 'BRD',
    'beastlord': 'BST',
    'berserker': 'BER',
    'cleric': 'CLR',
    'druid': 'DRU',
    'enchanter': 'ENC',
    'magician': 'MAG',
    'monk': 'MNK',
    'necromancer': 'NEC',
    'paladin': 'PAL',
    'ranger': 'RNG',
    'rogue': 'ROG',
    'shadowknight': 'SHD',
    'shaman': 'SHM',
    'warrior': 'WAR',
    'wizard': 'WIZ',
}










/**
 * Scrapes an item's click information from the given url.
 * 
 * @param {string} url The resource url.
 */
function scrapeItemClickInfo( url ) {
    let request = new XMLHttpRequest();
    request.addEventListener( 'error', function ( e ) {
        window.api.ipc.sendError( e );
    } );
    request.addEventListener( 'load', function () {

        try {
            
            let div = document.createElement( 'div' );
            document.body.appendChild( div );
            div.innerHTML = this.responseText;


            let effectLine = document.evaluate( "//div[contains(., 'Effect: ')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext()?.textContent?.split( 'Effect: ' )[ 1 ]?.split( /\r\n|\r|\n/gi )[ 0 ]?.trim();
            let classList = document.evaluate( "//td[contains(., 'Class: ')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext()?.textContent.split( 'Class: ' )[ 1 ]?.split( /\r\n|\r|\n/gi )[ 0 ]?.trim();

            // +(/Casting Time: (\d*\.?\d*)/gi.exec( "Spirit of Wolf - ing Time: 3.1Expendable - Charges: 5" ) ?? [ 'Casting Time: Instant', '0' ])[1]
            //      0
            // +(/Casting Time: (\d*\.?\d*)/gi.exec( "Spirit of Wolf - Casting Time: 3.1Expendable - Charges: 5" ) ?? [ 'Casting Time: Instant', '0' ])[1]
            //      3.1
            // +(/Casting Time: (\d*\.?\d*)/gi.exec( "Spirit of Wolf - Casting Time: InstantExpendable - Charges: 5" ) ?? [ 'Casting Time: Instant', '0' ])[1]
            //      0
            let castTime = +( /Casting Time: (\d*\.?\d*)/gi.exec( effectLine ) ?? [ 'Casting Time: Instant', '0' ] )[ 1 ];
            let levelCheck = ( /at Level ([0-9]+)/gi.exec( effectLine ) ?? [ '1', '1' ] )[ 1 ];

            let classes = [];
            classList?.split( ', ' )?.forEach( cls => {
                if ( cls && cls.toLowerCase() != 'all' ) {
                        
                    let classLevel = new CharacterClassLevel();
            
                    classLevel.class = classTransformer[ cls.toLowerCase() ] ?? cls.toLowerCase();
                    classLevel.level = +levelCheck;

                    classes.push( classLevel );
                }
            } );

            let clickEffect = new ScrapedClickEffect();

            clickEffect.classes = classes;
            clickEffect.name = document.title?.split( ' - ' )[ 0 ]?.trim() ?? 'Unknown Title';
            clickEffect.castTime = castTime * 1000;
        
            window.api.ipc.sendModel( clickEffect );
        } catch ( error ) {
            window.api.ipc.sendError( error );
        }

    } );
    request.open( 'GET', url );
    request.send();
}










/**
 * Scrapes a spell object from the given URL.
 * 
 * @param {string} url The resource url.
 */
function scrapeSpell( url ) {
    let request = new XMLHttpRequest();
    request.addEventListener( 'error', function ( e ) {
        window.api.ipc.sendError( e );
    } );
    request.addEventListener( 'load', function () {
        
        try {
            

            let div = document.createElement( 'div' );
            document.body.appendChild( div );
            div.innerHTML = this.responseText;
        

            // let test = document.querySelector('tr')
            let landOnYou = queryContains( 'tr', 'b', 'Land on You', 'td', 1 )?.innerHTML.trim();
            let landOnOther = queryContains( 'tr', 'b', 'Land on Other', 'td', 1 )?.innerHTML.trim();
            let wearsOff = queryContains( 'tr', 'b', 'Wear off', 'td', 1 )?.innerHTML.trim();
            let name = document.querySelectorAll( 'h2' )[ 0 ].textContent?.trim();
            // https://regex101.com/r/IqDrwx/1
            let gemSrc = div.querySelector( 'img[src*="spellicons"]' ).getAttribute( 'src' );
            let gemIndex = /.*\/(?<number>\d+).*/gi.exec( gemSrc ).groups?.number;
            let duration = queryContains( 'tr', 'b', 'Duration:', 'td', 1 )?.innerHTML.trim();
            let itemsSource = document.querySelector( '#items' );
            let itemAnchors = itemsSource.querySelectorAll( 'a' );
            // ex: "Paladin (12) - Ranger (20) - Beastlord (18) - Cleric (4) - Druid (9) - Shaman (9)"
            let classesList = document.querySelector( 'h2' ).parentElement.textContent.replaceAll( name, '' ).trim().split( ' - ' );
            let target = queryContains( 'tr', 'b', 'Target:', 'td', 1 )?.innerHTML.trim();
            let castingTime = queryContains( 'tr', 'b', 'Casting Time', 'td', 1 )?.innerHTML.trim();

            /** @type {ScrapedSpell} */
            let spell = new ScrapedSpell();

            spell.name = name;
            spell.duration = durationTextToSeconds( duration );
            spell.classes = parseClasses( classesList );
            spell.castOnOther = landOnOther;
            spell.castOnYou = landOnYou;
            // TODO: I don't believe this is used at all, but need to confirm.
            // I think maybe there are some instacast things that may use this text: here in the typescript
            //      let rawPhrase = this.spell.castOnYou ? this.spell.castOnYou : this.spell.youCast;
            spell.youCast = '';

            if ( target ) {
                spell.targetType = target;
            }

            if ( castingTime ) {
                spell.castTime = parseFloat( castingTime ) * 1000;
            } else {
                spell.castTime = 0;
            }

            if ( wearsOff ) {
                spell.effectFades = wearsOff;
            }

            if ( gemSrc ) {
                spell.gemSrc = gemSrc;
                spell.gemIndex = gemIndex;
            }

            let spellItems = parseItemsWithEffect( itemAnchors );
            spell.itemsWithEffect = spellItems.items;
            spell.itemClickOnly = !spellItems.hasSpellScroll;

            window.api.ipc.sendModel( spell );
        } catch ( error ) {
            window.api.ipc.sendError( error );
        }

    } );
    request.open( 'GET', url );
    request.send();
}










/**
 * Parses the given list of item anchors into a list of outside resources.
 * 
 * @returns {{items: OutsideResource[], hasSpellScroll: boolean}} Returns the parse outside resources.
 * 
 * @param {HTMLAnchorElement[]} itemAnchors The list of anchor tags pointing to external items with the desired click effect.
 */
function parseItemsWithEffect( itemAnchors ) {
    let output = {
        items: [],
        hasSpellScroll: false,
    };

    itemAnchors?.forEach( a => {
        let resource = new OutsideResource();

        resource.name = a.innerText;
        let href = a.getAttribute( 'href' );

        if ( href[ 0 ] === '/' ) {
            resource.url = `https://items.eqresource.com${href}`;
        } else {
            resource.url = href;
        }

        if ( resource.name.match( /^Scroll: /gi ) == null && resource.name.match( /^Spell: /gi ) == null && resource.name.match( /^Ancient: /gi ) == null ) {
            output.items.push( resource );
        } else {
            output.hasSpellScroll = true;
        }

    } );

    return output;
}










/**
 * Parses each element in the given array into a class level object.
 * 
 * @returns {CharacterClassLevel[]} Returns a list of class levels.
 * 
 * @param {string[]} classes The list of classes provided by the resource.
 */
function parseClasses( classes ) {
    /** @type {CharacterClassLevel[]} */
    let output = [];

    classes?.forEach( c => {
        // https://regex101.com/r/1BXAg6/1
        let match = /(?<className>.+)\s\((?<level>\d+)\)/gi.exec( c );
        if ( match.groups?.className ) {
            let model = new CharacterClassLevel();
            
            model.class = classTransformer[ match.groups.className.toLowerCase() ];
            model.level = +match.groups.level;

            output.push( model );
        }
    } );

    return output;
}










/**
 * Converts the given duration text into seconds.
 * 
 * @returns {number} Returns the number of seconds represented by the given text value.
 * 
 * @param {string} text The duration text.
 */
function durationTextToSeconds( text ) {

    if ( text?.indexOf( 'ticks' ) > -1 ) {
        return parseFloat( /([0-9]\sticks)(?!.*([0-9]\sticks))/.exec( text )[ 1 ] ) * 6;

    } else {
        // https://regex101.com/r/RbW5DM/1
        let hours = /(?<hours>\d*\.?\d*)h\s?/gi.exec( text );
        let minutes = /(?<minutes>\d*\.?\d*)m\s?/gi.exec( text );
        let seconds = /(?<seconds>\d*\.?\d*)s\s?/gi.exec( text );
        let d = 0;

        console.log( 'hours', hours );
        console.log( 'minutes', minutes );

        if ( hours?.groups?.hours ) {
            d += parseFloat( hours.groups.hours ) * 60 * 60;
        }

        if ( minutes?.groups?.minutes ) {
            d += parseFloat( minutes.groups.minutes ) * 60;
        }

        if ( seconds?.groups?.seconds ) {
            d += parseFloat( seconds.groups.seconds );
        }

        if ( d > 0 ) {
            return d;
        } else {
            return parseFloat( text ) * 10 * 6;
        }

    }
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
            let results = dom.querySelectorAll( childrensQuery );
            return results[childrensIndex];
        } else {
            return dom;
        }
    }

    if ( doms?.length > 0 ) {
        let dom = null;
        let di = -1;

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

            // if ( dom ) {
            //     break;
            // }
        }

        return dom;
    }

    return null;
}
