import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component( {
    selector: 'game-preview',
    templateUrl: 'game-preview.component.html',
    styleUrls: [ 'game-preview.component.scss' ],
} )
export class GamePreviewComponent implements OnInit {

    private _background: 'light' | 'dark' = 'dark';
    @Input( 'color' ) public set colorProp( color: 'light' | 'dark' ) {
        this._background = color;
    }
    @Output( 'colorChange' ) public getBackground: EventEmitter<'light' | 'dark'> = new EventEmitter<'light' | 'dark'>();

    public set background( value: 'light' | 'dark' ) {
        this._background = value;
        this.getBackground.emit( value );
    }
    public get background(): 'light' | 'dark' {
        return this._background;
    }

    constructor() { }

    ngOnInit() { }

}
