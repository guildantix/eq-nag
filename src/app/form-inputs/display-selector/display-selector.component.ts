import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IpcService } from 'src/app/ipc.service';

@Component( {
    selector: 'app-display-selector',
    templateUrl: 'display-selector.component.html',
    styleUrls: [ './display-selector.component.scss' ],
} )
export class DisplaySelectorComponent implements OnInit {
    
    @Input() public renderWidth: number = 400;
    @Input() public selectedMonitorId: number | null = null;
    @Output() public onMonitorSelect: EventEmitter<Electron.Display> = new EventEmitter<Electron.Display>();
    
    public displays: Electron.Display[] = [];
    public screenSpace: Electron.Rectangle;
    public get screenOrigin(): { x: number, y: number } {
        return { x: 0 - this.screenSpace.x, y: 0 - this.screenSpace.y };
    }
    public get renderHeight(): number {
        return this.screenSpace?.width > 0 ? ( this.renderWidth / this.screenSpace.width ) * this.screenSpace.height : 0;
    }

    private _selectedIndex: number = 0;
    public get selectedMonitorIndex(): number {
        return this._selectedIndex;
    }
    public set selectedMonitorIndex( value: number ) {
        this._selectedIndex = value;
        this.onMonitorSelect.emit( this.displays[ this._selectedIndex ] );
    }

    constructor( private ipcService: IpcService ) { }

    ngOnInit() {
        this.ipcService.getAllDisplays().subscribe( displays => {
            this.displays = displays;
            this.calculateScreenSpace();

            if ( this.selectedMonitorId != null ) {
                this.selectedMonitorIndex = this.displays.findIndex( f => f.id === this.selectedMonitorId );
            }
        } );
    }









    
    /**
     * Calculates the full screen space of all monitors.
     */
    calculateScreenSpace() {
        let left = 0, right = 0;
        let top = 0, bottom = 0;

        this.displays.forEach( display => {

            let absLeft = display.bounds.x;
            let absRight = display.bounds.x + display.bounds.width;
            let absTop = display.bounds.y;
            let absBottom = display.bounds.y + display.bounds.height;


            left = absLeft < left ? absLeft : left;
            right = absRight > right ? absRight : right;
            top = absTop < top ? absTop : top;
            bottom = absBottom > bottom ? absBottom : bottom;

        } );

        this.screenSpace = {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,
        };
    }









    
    /**
     * Returns the width by ratio of display.
     * 
     * @param realWidth The real width.
     */
    getDisplayWidth( realWidth: number ): number {
        return ( this.renderWidth / this.screenSpace?.width ) * realWidth ?? 0;
    }









    
    /**
     * Returns the height by ratio of display.
     * 
     * @param realWidth The real height.
     */
    getDisplayHeight( realHeight: number ): number {
        return ( this.renderWidth / this.screenSpace?.width ) * realHeight ?? 0;
    }









    
    /**
     * Returns the x-position by ratio of display.
     * 
     * @param realWidth The real x-position.
     */
    getDisplayLeft( realLeft: number ): number {
        let realPosLeft = this.screenOrigin.x + realLeft;
        return ( this.renderWidth / this.screenSpace?.width ) * realPosLeft ?? 0;
    }









    
    /**
     * Returns the y-position by ratio of display.
     * 
     * @param realWidth The real y-position.
     */
    getDisplayTop( realTop: number ): number {
        let realPosTop = this.screenOrigin.y + realTop;
        return ( this.renderWidth / this.screenSpace?.width ) * realPosTop ?? 0;
    }

}
