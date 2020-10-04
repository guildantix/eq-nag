import { Injectable } from '@angular/core';
import { Observable, Observer } from 'rxjs';
import { ScrapedSpell } from './core.model';

@Injectable()
export class ScraperService {
    constructor() { }

    public ScrapeAllakhazamSpell( url: string, currentCharacterClass: string ): Observable<ScrapedSpell> {
        let obs: Observable<ScrapedSpell> = new Observable<ScrapedSpell>( ( observer: Observer<ScrapedSpell> ) => {
            
            var oReq = new XMLHttpRequest();
            oReq.addEventListener( "load", function () {
                let div = document.createElement( 'div' );
                div.style.display = 'none';
                document.body.appendChild( div );
                div.innerHTML = this.responseText;
    
                let data = {
                    name: div.querySelector( 'meta[property="og:title"]' ).getAttribute( 'content' ),
                    duration: 0,
                    _duration: document.evaluate( "//strong[contains(., 'Duration:')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext().nextSibling.nextSibling.textContent.trim(),
                    class: document.evaluate( "//div[contains(@class, 'db-infobox')]/table/tbody/tr/td/strong[contains(., '" + currentCharacterClass + "')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext().textContent,
                    level: +document.evaluate( "//div[contains(@class, 'db-infobox')]/table/tbody/tr/td/strong[contains(., '" + currentCharacterClass + "')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext().parentNode.nextSibling.textContent,
                    castOnOther: document.evaluate( "//blockquote[contains(., 'Cast on other')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext().textContent.split( 'Cast on other: ' )[ 1 ].split( 'Effect Fades: ' )[ 0 ],
                };
    
                if ( data._duration.indexOf( 'ticks' ) > -1 ) {
                    data.duration = parseFloat( data._duration ) * 6;
                } else {
                    data.duration = parseFloat( data._duration ) * 10 * 6;
                }
    
                // console.log( 'found', model );
    
                document.body.removeChild( div );
                div = null;

                let model = new ScrapedSpell();

                model.name = data.name;
                model.duration = data.duration;
                // model.class = data.class;
                model.level = data.level;
                model.castOnOther = data.castOnOther;

                observer.next( model );
                observer.complete();

            } );
            oReq.open( "GET", url );
            oReq.send();

        } );

        return obs;
    }
    
}
