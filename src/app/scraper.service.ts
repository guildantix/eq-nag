import { Injectable } from '@angular/core';
import { forkJoin, Observable, Observer } from 'rxjs';
import { CharacterClasses, CharacterClassLevel, OutsideResource, ScrapedAbility, ScrapedClickEffect, ScrapedNpc, ScrapedSpell } from './core.model';
import { StringUtility } from './utilities';

const allakhazamUrl: string = 'https://everquest.allakhazam.com';

@Injectable()
export class ScraperService {

    constructor() { }










    /**
     * Scrapes ability information from the given allakhazam URL.
     * 
     * @returns Returns the ScrapedAbility.
     * 
     * @param url The allakhazam URL for the desired ability.
     */
    public ScrapeAllakhazamAbility( url: string ): Observable<ScrapedAbility> {
        let obs: Observable<ScrapedAbility> = new Observable<ScrapedAbility>( ( observer: Observer<ScrapedAbility> ) => {
            const _scraper = this;
            var oReq = new XMLHttpRequest();
            oReq.addEventListener( "load", function (ev) {
                let div = document.createElement( 'div' );
                div.style.display = 'none';
                document.body.appendChild( div );
                div.innerHTML = this.responseText;

                let data = {
                    name: div.querySelector( 'meta[property="og:title"]' ).getAttribute( 'content' ),
                    spellGem: div.querySelector( 'img[src*="spellicons"]' ),
                    duration: 0,
                    _duration: document.evaluate( "//strong[contains(., 'Duration:') and not(contains(., 'AE Duration'))]", document, null, XPathResult.ANY_TYPE, null ).iterateNext().nextSibling.nextSibling.textContent.trim(),
                    castOnOther: document.evaluate( "//blockquote[contains(., 'Cast on other')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext()?.textContent.split( 'Cast on other: ' )[ 1 ].split( 'Effect Fades: ' )[ 0 ],
                    castOnYou: document.evaluate( "//blockquote[contains(., 'Cast on you')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext()?.textContent.split( 'Cast on you: ' )[ 1 ].split( 'Cast on other: ' )[ 0 ],
                };

                // ./book[./author/name = 'John'] 
                // https://stackoverflow.com/a/9683142
                let resistCheck = document.evaluate( "//td[./strong = 'Resist:']/following-sibling::td[1]", document, null, XPathResult.ANY_TYPE, null ).iterateNext();
                let castingTimeCheck = document.evaluate( "//td[./strong = 'Casting Time:']/following-sibling::td[1]", document, null, XPathResult.ANY_TYPE, null ).iterateNext();
                let resistMod = document.evaluate( "//td[./strong = 'Resist Adjust:']/following-sibling::td[1]", document, null, XPathResult.ANY_TYPE, null ).iterateNext();

                // //a/bb[text()="zz"]/following-sibling::cc[1]/text()
                let descriptionBlock = document.evaluate( '//tr[./td/h2 = "Description"]/following-sibling::tr[1]//blockquote', document, null, XPathResult.ANY_TYPE, null ).iterateNext();

                let npcsWithAbilityResult = document.evaluate( '//div[@id="NPCs_with_Ability_t"]//li/a', document, null, XPathResult.ANY_TYPE, null );

                let durRange = /^(?<minDuration>\d*\.?\d*) (?<minDurationType>ticks|mins|min) @L\d{1,3} to (?<duration>\d*\.?\d*) (?<durationType>ticks|mins|min) @L\d{1,3}$/gi.exec( data._duration );
                
                if ( durRange?.length > 0 ) {
                    if ( durRange.groups.durationType === 'mins' || durRange.groups.durationType === 'min' ) {
                        data.duration = parseFloat( durRange.groups.duration ) * 10 * 6;
                    } else if ( durRange.groups.durationType === 'ticks' ) {
                        data.duration = parseFloat( durRange.groups.duration ) * 6;
                    }

                } else if ( data._duration.indexOf( 'ticks' ) > -1 ) {
                    data.duration = parseFloat( /([0-9]\sticks)(?!.*([0-9]\sticks))/.exec( data._duration )[ 1 ] ) * 6;

                } else {
                    let hours = /(?<hours>\d*\.?\d*) hour/gi.exec( data._duration );
                    let minutes = /(?<minutes>\d*\.?\d*) mins/gi.exec( data._duration );
                    let d = 0;

                    if ( hours?.groups?.hours ) {
                        d += parseFloat( hours.groups.hours ) * 60 * 60;
                    }

                    if ( minutes?.groups?.minutes ) {
                        d += parseFloat( minutes.groups.minutes ) * 60;
                    }

                    if ( d > 0 ) {
                        data.duration = d;
                    } else {
                        data.duration = parseFloat( data._duration ) * 10 * 6;
                    }
                }

                let model = new ScrapedAbility();
                
                model.name = data.name?.trim();
                model.duration = data.duration;
                model.castOnOther = data.castOnOther?.trim()?.replace( / +(?= )/g, '' );
                model.castOnYou = data.castOnYou?.trim()?.replace( / +(?= )/g, '' );

                if ( data.spellGem != null ) {
                    model.gemSrc = data.spellGem.getAttribute( 'src' );
                    model.gemIndex = +/.*gem_([0-9]*).*/.exec( model.gemSrc )[ 1 ];
                } else {
                    model.gemIndex = -1;
                }

                if ( descriptionBlock ) {
                    
                    let cureCheck = /Increase (?<cureType>Disease|Poison|Curse) Counter by (?<counters>[0-9]+)/g.exec( descriptionBlock.textContent );
                    if ( cureCheck?.length > 0 ) {
                        model.cureType = cureCheck.groups.cureType;
                        model.counters = +cureCheck.groups.counters;
                    }

                    let stunCheck = /(?<effect>Stun)/gi.exec( descriptionBlock.textContent );
                    if ( stunCheck?.length > 0 ) {
                        model.stun = true;
                    }

                    let silenceCheck = /(?<effect>Silence)/gi.exec( descriptionBlock.textContent );
                    if ( silenceCheck?.length > 0 ) {
                        model.silence = true;
                    }

                    let manaDrainCheck = /(?<effect>Decrease Mana).*tick/gi.exec( descriptionBlock.textContent );
                    if ( manaDrainCheck?.length > 0 ) {
                        model.manaDrain = true;
                    }
                }

                if ( resistCheck ) {
                    model.resistType = resistCheck?.textContent?.trim();
                }

                if ( castingTimeCheck ) {
                    model.castTime = parseFloat( castingTimeCheck.textContent ) * 1000;
                }

                if ( resistMod ) {
                    model.resistMod = +resistMod?.textContent?.trim();
                }

                if ( npcsWithAbilityResult ) {
                    model.npcsWithAbility = [];

                    let node = npcsWithAbilityResult.iterateNext() as HTMLAnchorElement;
                    let npcUrls = [];
                    while ( node != null ) {
                        npcUrls.push( node.getAttribute( 'href' ) );
                        node = npcsWithAbilityResult.iterateNext() as HTMLAnchorElement;
                    }
                    
                    let npcData = [];
                    npcUrls?.forEach( url => {
                        npcData.push( _scraper.ScrapeNpcData( allakhazamUrl + url ) );
                    } );
                    
                    forkJoin( npcData ).subscribe( ( results: ScrapedNpc[] ) => {
                        model.npcsWithAbility = model.npcsWithAbility.concat( results );
                        _scraper.completObserver( div, observer, model );
                    } );
                } else {
                    _scraper.completObserver( div, observer, model );
                }

            } );
            oReq.open( "GET", url );
            oReq.send();

        } );
        return obs;
    }









    
    /**
     * Passes the given model to the observer and completes the observer.
     * 
     * @param div The HTML Div element that was appended to parse the data.
     * @param observer The observer.
     * @param model The model to next.
     */
    private completObserver<T>( div: HTMLDivElement, observer: Observer<T>, model: T ): void {
    
        document.body.removeChild( div );
        div = null;

        observer.next( model );
        observer.complete();

    }










    /**
     * Scrapes NPC information from the given allakhazam URL.
     * 
     * @returns Returns the ScrapedNpc model.
     * 
     * @param url The allakhazam URL for the desired NPC.
     */
    public ScrapeNpcData( url: string ): Observable<ScrapedNpc> {
        let obs: Observable<ScrapedNpc> = new Observable<ScrapedNpc>( ( observer: Observer<ScrapedNpc> ) => {
            var oReq = new XMLHttpRequest();
            oReq.addEventListener( "load", function () {
                let div = document.createElement( 'div' );
                div.style.display = 'none';
                document.body.appendChild( div );
                div.innerHTML = this.responseText;

                let npc = new ScrapedNpc();
                npc.url = url;

                let mobZones = document.evaluate( "//div[@class='mobzones']/a", document, null, XPathResult.ANY_TYPE, null );

                if ( mobZones ) {
                    npc.zones = [];
                    let node = mobZones.iterateNext() as HTMLAnchorElement;
                    while ( node != null ) {
                        npc.zones.push( node.textContent );
                        node = mobZones.iterateNext() as HTMLAnchorElement;
                    }
                }

                let mobName = document.evaluate( "//div[@class='mobDisplay']/h1", document, null, XPathResult.ANY_TYPE, null );

                if ( mobName != null ) {
                    npc.name = mobName.iterateNext().textContent?.trim();
                }
                
                document.body.removeChild( div );
                div = null;

                observer.next( npc );
                observer.complete();

            } );
            oReq.open( "GET", url );
            oReq.send();
        } );

        return obs;
    }










    /**
     * Scrapes item click information from the given allakhazam URL.
     * 
     * @returns Returns the ScrapedClickEffect.
     * 
     * @param url The allakhazam URL for the desired item.
     */
    public ScrapeAllakhazamItemClickInfo( url: string ): Observable<ScrapedClickEffect> {

        let obs = new Observable<ScrapedClickEffect>( observer => {

            var oReq = new XMLHttpRequest();
            oReq.addEventListener( "load", function () {
                let div = document.createElement( 'div' );
                div.style.display = 'none';
                document.body.appendChild( div );
                div.innerHTML = this.responseText;
    
                let data = {
                    name: div.querySelector( 'meta[property="og:title"]' ).getAttribute( 'content' ),
                    effectLine: document.evaluate( "//div[contains(@class, 'nobgrd') and contains(., 'Effect: ')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext()?.textContent?.split( 'Effect: ' )[ 1 ]?.split( /\r\n|\r|\n/gi )[ 0 ]?.trim(),
                    classList: document.evaluate( "//div[contains(@class, 'nobgrd') and contains(., 'Class: ')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext()?.textContent.split( 'Class: ' )[ 1 ]?.split( /\r\n|\r|\n/gi )[ 0 ]?.trim(),
                };

                let castingTimeCheck = ( /Casting Time: (.*)\)/gi.exec( data.effectLine ) ?? [ '0' ] )[ 1 ];
                let levelCheck = ( /at Level ([0-9]+)/gi.exec( data.effectLine ) ?? [ '1' ] )[ 1 ];
                let classes: CharacterClassLevel[] = [];

                data.classList?.split( /\s/gi )?.forEach( cls => {
                    if ( cls?.toLowerCase() != 'all' ) {
                        
                        let classLevel = new CharacterClassLevel();
                    
                        classLevel.class = cls;
                        classLevel.level = +levelCheck;

                        classes.push( classLevel );
                    }
                } );
                
                document.body.removeChild( div );
                div = null;

                let model = new ScrapedClickEffect();

                model.name = data.name;
                model.classes = classes;
                model.castTime = castingTimeCheck == null ? 0 :
                                 castingTimeCheck.toLowerCase() == 'instant' ? 0 :
                                 +castingTimeCheck * 1000;

                console.log( 'model', model );
                observer.next( model );
                observer.complete();

            } );
            
            oReq.open( "GET", url );
            oReq.send();
        } );

        return obs;
    }










    /**
     * Scrapes spell information from the given allakhazam URL.
     * 
     * @returns Returns the ScrapedSpell model.
     * 
     * @param url The allakhazam URL for the desired spell.
     */
    public ScrapeAllakhazamSpell( url: string ): Observable<ScrapedSpell> {
        let obs: Observable<ScrapedSpell> = new Observable<ScrapedSpell>( ( observer: Observer<ScrapedSpell> ) => {
            
            var oReq = new XMLHttpRequest();
            oReq.addEventListener( "load", function () {
                let div = document.createElement( 'div' );
                div.style.display = 'none';
                document.body.appendChild( div );
                div.innerHTML = this.responseText;
    
                let spellEmoteSources = (<HTMLElement>document.evaluate( "//blockquote[contains(., 'Cast on other') or contains(., 'Cast on you') or contains(., 'Effect Fades')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext())?.innerHTML.split( '<br>' );
                let spellEmotes: Record<string, string> = {};
                for ( let i = 0; i < spellEmoteSources.length; i++ ) {
                    let emote = spellEmoteSources[ i ].split( ':' );
                    if ( emote?.length > 1 ) {
                        spellEmotes[ emote[ 0 ].trim() ] = emote[ 1 ].trim();
                    }
                }

                let data = {
                    name: div.querySelector( 'meta[property="og:title"]' ).getAttribute( 'content' ),
                    spellGem: div.querySelector( 'img[src*="spellicons"]' ),
                    duration: 0,
                    _duration: document.evaluate( "//strong[contains(., 'Duration:')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext()?.nextSibling.nextSibling.textContent.trim(),
                    itemsWithEffect: document.evaluate( "//tr//td//h2[contains(., 'Items with this effect')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext()?.parentElement.parentElement.nextElementSibling,
                    castOnOther: spellEmotes[ 'Cast on other' ],
                    castOnYou: spellEmotes[ 'Cast on you' ],
                    effectFades: spellEmotes[ 'Effect Fades' ],
                    youCast: spellEmotes[ 'You cast' ],
                };
                
                data.name = data.name.match( /^Ancient\s/ ) ? StringUtility.Insert( data.name, ':', /^Ancient\s/.exec( data.name ).index + 'Ancient'.length ) : data.name;

                let classes: CharacterClassLevel[] = [];
                for ( const key of Object.keys( CharacterClasses ) ) {
                    let classContainer = document.evaluate( "//div[contains(@class, 'db-infobox')]/table/tbody/tr/td/strong[contains(., '" + CharacterClasses[ key ] + "')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext();
                    if ( classContainer != null ) {
                        let characterClass: string = classContainer.textContent;
                        let level: number = +document.evaluate( "//div[contains(@class, 'db-infobox')]/table/tbody/tr/td/strong[contains(., '" + CharacterClasses[ key ] + "')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext().parentNode.nextSibling.textContent;
                        
                        if ( level > 0 ) {
                            let classLevel = new CharacterClassLevel();
                            classLevel.class = characterClass;
                            classLevel.level = level;
    
                            classes.push( classLevel );
                        }
                    }

                }
                
                // durRange is for: 3.3 mins @L1 to 27.0 mins @L9
                let durRange = /^(?<minDuration>\d*\.?\d*) mins @L\d{1,3} to (?<duration>\d*\.?\d*) mins @L\d{1,3}$/gi.exec( data._duration );
                
                if ( durRange?.length > 0 ) {
                    data.duration = parseFloat( durRange.groups.duration ) * 10 * 6;

                } else if ( data._duration.indexOf( 'ticks' ) > -1 ) {
                    data.duration = parseFloat( /([0-9]\sticks)(?!.*([0-9]\sticks))/.exec( data._duration )[ 1 ] ) * 6;

                } else {
                    let hours = /(?<hours>\d*\.?\d*) hour/gi.exec( data._duration );
                    let minutes = /(?<minutes>\d*\.?\d*) mins/gi.exec( data._duration );
                    let d = 0;

                    if ( hours?.groups?.hours ) {
                        d += parseFloat( hours.groups.hours ) * 60 * 60;
                    }

                    if ( minutes?.groups?.minutes ) {
                        d += parseFloat( minutes.groups.minutes ) * 60;
                    }

                    if ( d > 0 ) {
                        data.duration = d;
                    } else {
                        data.duration = parseFloat( data._duration ) * 10 * 6;
                    }
                }

                let targetTypeCheck = document.evaluate( "//td[./strong = 'Target Type:']/following-sibling::td[1]", document, null, XPathResult.ANY_TYPE, null ).iterateNext();
                let castingTimeCheck = document.evaluate( "//td[./strong = 'Casting Time:']/following-sibling::td[1]", document, null, XPathResult.ANY_TYPE, null ).iterateNext();
    
                document.body.removeChild( div );
                div = null;

                let model = new ScrapedSpell();

                model.name = data.name.replace(/ Rk\. III| Rk\. II/gi, '');
                model.duration = data.duration;
                model.classes = classes;
                model.castOnOther = data.castOnOther?.trim()?.replace( / +(?= )/g, '' );
                model.castOnYou = data.castOnYou?.trim()?.replace( / +(?= )/g, '' );
                model.youCast = data.youCast?.trim()?.replace( / +(?= )/g, '' );
                
                if ( targetTypeCheck ) {
                    model.targetType = targetTypeCheck.textContent?.trim();
                }

                if ( castingTimeCheck && castingTimeCheck.textContent?.trim().toLowerCase() !== 'instant' ) {
                    model.castTime = parseFloat( castingTimeCheck.textContent ) * 1000;
                } else {
                    model.castTime = 0;
                }

                if ( data.effectFades != null ) {
                    model.effectFades = data.effectFades;
                }

                if ( data.spellGem != null ) {
                    // let rgx = /.*gem_([0-9]*).*/;
                    model.gemSrc = data.spellGem.getAttribute( 'src' );
                    model.gemIndex = +/.*gem_([0-9]*).*/.exec( model.gemSrc )[ 1 ];
                } else {
                    model.gemIndex = -1;
                }
                
                // Scrape items with this effect into outside resources.
                let itemAnchors = data.itemsWithEffect?.querySelectorAll( 'a' );
                
                // If there are items with this effect, we set this to true.
                // If we find a spell scroll in the list of items, we set this 
                // to false.
                model.itemClickOnly = itemAnchors?.length > 0;

                itemAnchors?.forEach( a => {
                    let resource = new OutsideResource();
                    
                    resource.name = a.innerText;
                    let href = a.getAttribute( 'href' );
                    if ( href[ 0 ] === '/' ) {
                        resource.url = `https://everquest.allakhazam.com${href}`;
                    } else {
                        resource.url = href;
                    }

                    if ( resource.name.match( /^Spell: /gi ) == null && resource.name.match( /^Ancient: /gi ) == null ) {
                        model.itemsWithEffect.push( resource );
                    } else {
                        model.itemClickOnly = false;
                    }
                    
                } );

                observer.next( model );
                observer.complete();

            } );
            oReq.open( "GET", url );
            oReq.send();

        } );

        return obs;
    }
    
}
