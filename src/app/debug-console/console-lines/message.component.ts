import { Component, Input, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ConsoleMessageModel, LogTypes } from 'src/app/core.model';

@Component( {
    selector: 'console-message',
    templateUrl: 'message.component.html',
    styleUrls: [ 'message.component.scss' ],
} )
export class ConsoleMessageComponent implements OnInit {

    private _item: ConsoleMessageModel;
    @Input( 'item' ) public set item( value: ConsoleMessageModel ) {
        this._item = value;
        this.payloadHtml = undefined;
        if ( value.payload ) {
            this.renderParseToHtml( value.payload );
        }
    }
    public get item(): ConsoleMessageModel {
        return this._item;
    }
    public logTypes: typeof LogTypes = LogTypes;
    public payloadHtml: SafeHtml | undefined = undefined;
    public get renderPayload(): boolean {
        return this.item.payload !== null && this.item.payload !== undefined;
    }
    public expanded: boolean = false;

    constructor(
        private readonly sanitizer: DomSanitizer,
    ) { }

    ngOnInit() { }









    
    /**
     * Renders the given object as an unordered list.
     * 
     * @returns The rendered html.
     * 
     * @param obj The object to render.
     */
    public renderParseToHtml( obj: any ): void {
        
        if ( !this.payloadHtml ) {
            this.payloadHtml = this.sanitizer.bypassSecurityTrustHtml( this.renderJsonHtml( obj ) );
        }

    }









    
    /**
     * Renders the given json object as an unordered list.
     */
    public renderJsonHtml( json: any ): string {
        if ( json === null ) {
            return '<span class="color-purple"><i>null</i></span>';
        }

        if ( json instanceof Error ) {
            let html = '<ul>';

            if ( json.name ) {
                html += `<li><b>name</b>: <span class="color-brown">"${json.name}"</span></li>`;
            }
            
            if ( json.message ) {
                html += `<li><b>message</b>: <span class="color-brown">"${json.message}"</span></li>`;
            }

            if ( json.stack ) {
                html += `<li><b>stack</b>: <span class="color-brown">"${json.stack}"</span></li>`;
            }

            html += '</ul>';

            return html;
        } else {
            
            let keys = Object.keys( json );

            if ( keys.length === 0 ) {
                return '<span>{}</span>';
            }

            let html = '<ul>';
            for ( let key of keys ) {
                let obj = false;
                let emptyArray = false;

                let value = json[ key ];
                if ( value !== null && value !== undefined && Array.isArray( value ) && value.length === 0 ) {
                    emptyArray = true;
                    value = '[]';
                } else if ( value !== null && value !== undefined && typeof value === 'object' ) {
                    obj = true;
                    value = this.renderJsonHtml( value );
                }

                if ( obj ) {
                    html += `<li><b class="color-blue">${key}</b>: ${value}</li>`;
                } else if ( typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint' ) {
                    html += `<li><b class="color-blue">${key}</b>: <span class="color-purple">${value}</span></li>`;
                } else if ( value === null ) {
                    html += `<li><b class="color-blue">${key}</b>: <span style="color: #808080;"><i>null</i></span></li>`;
                } else if ( value === undefined ) {
                    html += `<li><b class="color-blue">${key}</b>: <span style="color: #808080;"><i>undefined</i></span></li>`;
                } else if ( emptyArray ) {
                    html += `<li><b class="color-blue">${key}</b>: ${value}</li>`;
                } else if ( typeof value === 'string' && value.match( /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/gi ) ) {
                    html += `<li><b class="color-blue">${key}</b>: <span>${new Date( value )}</span></li>`;
                } else {
                    html += `<li><b class="color-blue">${key}</b>: <span class="color-brown">"${value?.replace( /</gmi, '&lt;' ).replace( />/gmi, '&gt;' )}"</span></li>`;
                }
            
            }
            html += '</ul>';

            return html;
        }

    }

}
