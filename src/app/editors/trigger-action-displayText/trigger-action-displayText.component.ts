import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ContextMenuModel } from 'src/app/context-menu/context-menu.model';
import { ContextService } from 'src/app/context-menu/context.service';
import { OverlayWindowModel, TriggerAction } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';

const availableFonts = {
    'Roboto': [ 100, 300, 400, 500, 700, 900 ],
    'Red Rose': [ 300, 400, 700 ],
    'Oswald': [ 200, 300, 400, 500, 600, 700 ],
    'Roboto Mono': [ 100, 200, 300, 400, 500, 600, 700 ],
    'Open Sans Condensed': [ 300, 700 ],
    'Ranchers': [ 400 ],
    'Press Start 2P': [ 400 ],
};

/**
 * Returns a hex number for the given value.
 * 
 * @param {number} c The value to convert.
 */
function componentToHex( c ) {
    var hex = Math.round(c).toString( 16 );
    return hex.length == 1 ? "0" + hex : hex;
}

@Component( {
    selector: 'app-trigger-action-display-text',
    templateUrl: 'trigger-action-displayText.component.html',
    styleUrls: ['trigger-action-displayText.component.scss']
} )
export class TriggerActionDisplayTextComponent implements OnInit {

    public selectedOverlay: OverlayWindowModel = null;
    public fontWeightIndex: number = 0;
    public showColoredBackground: boolean = false;

    public get fontSize(): string {
        if ( this.action.textUseCustomSize && this.action.textSize ) {
            return `${this.action.textSize}px`;
        } else if ( this.selectedOverlay ) {
            return `${this.selectedOverlay.fontSize}px`;
        } else {
            return '12px';
        }
    }

    public get fontSpacing(): string {
        if ( this.action.textSpacing ) {
            return `${( this.action.textSpacing > 10 ? this.action.textSpacing : 90 ) / 100}em`;
        } else if ( this.selectedOverlay ) {
            return `${( this.selectedOverlay.lineHeight > 10 ? this.selectedOverlay.lineHeight : 90 ) / 100}em`;
        } else {
            return '1em';
        }
    }

    public get fontColor(): string {
        if ( this.action.textUseCustomColor && this.action.textColor ) {
            return `${this.action.textColor}`;
        } else if ( this.selectedOverlay ) {
            return `${this.selectedOverlay.fontColor}`;
        } else {
            return null;
        }
    }

    public get fontFamily(): string {
        if ( this.action.textUseCustomFont && this.action.textFont ) {
            return `${this.action.textFont}`;
        } else if ( this.selectedOverlay ) {
            return `${this.selectedOverlay.fontFamily}`;
        } else {
            return null;
        }
    }

    public get fontWeight(): string {
        if ( this.action.textUseCustomFont && this.action.textWeight ) {
            return `${this.action.textWeight}`;
        } else if ( this.selectedOverlay ) {
            return `${this.selectedOverlay.fontWeight}`;
        } else {
            return null;
        }
    }
    
    public get maxFontWeightIndex(): number {
        if ( this.fontFamily != null ) {
            return availableFonts[ this.fontFamily ].length - 1;
        } else {
            return 1;
        }
    }

    public get textShadow(): string {
        let shdw = null;
        if ( this.action.textUseCustomBorder && this.action.textBorderColor ) {
            shdw = shdw ? shdw : '';
            shdw += `0px 0px 1px ${this.action.textBorderColor}, -1px -1px 0 ${this.action.textBorderColor}, 1px -1px 0 ${this.action.textBorderColor}, -1px 1px 0 ${this.action.textBorderColor}, 1px 1px 0 ${this.action.textBorderColor}`;
        } else if ( this.selectedOverlay?.textBorderColor ) {
            shdw = shdw ? shdw : '';
            shdw += `0px 0px 1px ${this.selectedOverlay.textBorderColor}, -1px -1px 0 ${this.selectedOverlay.textBorderColor}, 1px -1px 0 ${this.selectedOverlay.textBorderColor}, -1px 1px 0 ${this.selectedOverlay.textBorderColor}, 1px 1px 0 ${this.selectedOverlay.textBorderColor}`;
        }

        if ( this.action.textUseCustomGlow && this.action.textGlowColor && this.action.textGlowSize ) {
            shdw = shdw ? shdw + ',' : '';
            shdw += `0px 0px ${this.action.textGlowSize}px ${this.action.textGlowColor}, -1px -1px ${this.action.textGlowSize}px ${this.action.textGlowColor}, 1px -1px ${this.action.textGlowSize}px ${this.action.textGlowColor}, -1px 1px ${this.action.textGlowSize}px ${this.action.textGlowColor}, 1px 1px ${this.action.textGlowSize}px ${this.action.textGlowColor}`;
        } else if ( this.selectedOverlay?.textGlowColor && this.selectedOverlay?.textGlowSize ) {
            shdw = shdw ? shdw + ',' : '';
            shdw += `0px 0px ${this.selectedOverlay.textGlowSize}px ${this.selectedOverlay.textGlowColor}, -1px -1px ${this.selectedOverlay.textGlowSize}px ${this.selectedOverlay.textGlowColor}, 1px -1px ${this.selectedOverlay.textGlowSize}px ${this.selectedOverlay.textGlowColor}, -1px 1px ${this.selectedOverlay.textGlowSize}px ${this.selectedOverlay.textGlowColor}, 1px 1px ${this.selectedOverlay.textGlowSize}px ${this.selectedOverlay.textGlowColor}`;
        }
        
        return shdw;
    }

    private overlays: OverlayWindowModel[] = [];

    @Input() public action: TriggerAction;
    @Input() public overlayOptions: OverlayWindowModel[] = [];

    constructor(
        private ipcService: IpcService,
        private contextService: ContextService,
    ) { }

    ngOnInit() {
        this.ipcService.getOverlayWindows().subscribe( overlays => {
            this.overlays = overlays;

            if ( this.action.overlayId ) {
                this.loadOverlayDefaults();
                this.onChangeFontFamily();
            }
        } );
    }









    
    /**
     * When the user changes the font family, this loads the selected font 
     * family's availabe properties.
     */
    public onChangeFontFamily(): void {
        let fi: number = availableFonts[ this.fontFamily ].indexOf( this.action.textWeight );
        this.fontWeightIndex = -1;

        if ( fi > -1 ) {
            this.fontWeightIndex = fi;

        } else {

            for ( let i = 100; i < 500; i += 100 ) {
                let lfi: number = availableFonts[ this.fontFamily ].indexOf( this.action.textWeight - i );
                let ufi: number = availableFonts[ this.fontFamily ].indexOf( this.action.textWeight + i );
                if ( lfi > -1 ) {
                    this.fontWeightIndex = lfi;
                    break;
                } else if ( ufi > -1 ) {
                    this.fontWeightIndex = ufi;
                    break;
                }
            }
            
        }

        this.fontWeightIndex = this.fontWeightIndex > -1 ? this.fontWeightIndex : 0;
    }









    
    /**
     * Changes the preview's font weight value based on the selected font 
     * weight index.
     */
    onFontWeightChange(): void {
        this.action.textWeight = availableFonts[ this.fontFamily ][ this.fontWeightIndex ];
    }









    
    /**
     * Loads the style defaults for this action's selected overlay.
     */
    private loadOverlayDefaults(): void {
        this.selectedOverlay = this.overlays.find( f => f.overlayId === this.action.overlayId );
    }

    public getActionCtxMenu( action: TriggerAction ): ContextMenuModel[] {
        return [ <ContextMenuModel>{
            label: 'Copy Properties',
            action: () => this.contextService.copyTriggerActionProperties( action ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'content_copy',
        }, <ContextMenuModel>{
            label: 'Paste Properties',
            action: () => this.contextService.pasteTriggerActionProperties( action ),
            disabled: () => !this.contextService.hasActionProperties,
            hide: () => false,
            matIcon: 'content_paste',
        } ];
    }

}
