import { Component, OnInit, HostListener } from '@angular/core';
import { IpcService } from 'src/app/ipc.service';
import { OverlayWindowModel, ActionTypes, TriggerAction, TimerSortTypes, TimerRestartBehaviors, StylePropertiesModel } from 'src/app/core.model';
import { ActivatedRoute } from '@angular/router';
import { ThemePalette } from '@angular/material/core';
import { AbstractControl, FormControl } from '@angular/forms';
import { ColorUtility, Color } from '../../utilities';
import { customAlphabet } from 'nanoid';
import { MonitorSelectDialogComponent } from '../monitor-select-dialog/monitor-select-dialog.component';
import { MatDialog } from '@angular/material/dialog';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
// import { Color } from '@angular-material-components/color-picker';
// import { NgForm } from '@angular/forms';

const availableFonts = {
    'Roboto': [ 100, 300, 400, 500, 700, 900 ],
    'Red Rose': [ 300, 400, 700 ],
    'Oswald': [ 200, 300, 400, 500, 600, 700 ],
    'Roboto Mono': [ 100, 200, 300, 400, 500, 600, 700 ],
    'Open Sans Condensed': [ 300, 700 ],
    'Ranchers': [ 400 ],
    'Press Start 2P': [ 400 ],
};
// <!-- Roboto(i): 100, 300, 400, 500, 700, 900 -->
// <!-- Red Rose: 300, 400, 700 -->
// <!-- Oswald: 200, 300, 400, 500, 600, 700 -->
// <!-- Roboto Mono (i): 100, 200, 300, 400, 500, 600, 700 -->
// <!-- Open Sans Condensed: 300(i), 700 -->
// <!-- Ranchers: 400 -->
// <!-- Press Start 2P: 400 -->

@Component( {
    selector: 'app-overlay-editor-dialog',
    templateUrl: 'overlay-editor-dialog.component.html',
    styleUrls: [ 'overlay-editor-dialog.component.scss', '../../core.scss', '../../modal.scss' ],
} )
export class OverlayEditorDialogComponent implements OnInit {

    public model: OverlayWindowModel;
    public phraseTableColumns = [ 'number', 'phrase', 'regEx', 'delete' ];
    public overlayId: string = null;
    public fontWeightIndex: number = 0;
    public dotGroupHeaderWeightIndex: number = 0;
    public color: ThemePalette = 'primary';
    public fontColor: Color = new Color( 255, 255, 255, 1 );
    public fontTransparency: number = 100;
    public backgroundTransparency: number = 0;
    public borderTransparency: number = 0;
    public _noChangesModel: OverlayWindowModel;
    public timerSortTypes: typeof TimerSortTypes = TimerSortTypes;
    public textBorderIntensity: number = 100;
    public textBorderColor: string = '#000000';
    public textGlowIntensity: number = 100;
    public textGlowColor: string = '#000000';
    public enterDescription: boolean;
    public showColoredBackground: boolean = false;
    
    public get maxFontWeightIndex(): number {
        if ( this.model?.fontFamily != null ) {
            return availableFonts[ this.model.fontFamily ].length - 1;
        } else {
            return 1;
        }
    }

    public get fontWeight(): string {
        if ( this.fontWeightIndex >= 0 ) {
            return `${availableFonts[ this.model.fontFamily ][ this.fontWeightIndex ]}`;
        } else {
            return null;
        }
    }

    public get textShadow(): string {
        let shdw = null;
        if ( this.model.showTextBorder && this.textBorderColor ) {
            let textBorderColor = ColorUtility.FromHex( this.textBorderColor ).toHexString( this.model.textBorderIntensity );
            shdw = shdw ? shdw : '';
            shdw += `0px 0px 1px ${textBorderColor}, -1px -1px 0 ${textBorderColor}, 1px -1px 0 ${textBorderColor}, -1px 1px 0 ${textBorderColor}, 1px 1px 0 ${textBorderColor}`;
        }

        if ( this.model.showTextGlow && this.textGlowColor && this.textGlowIntensity ) {
            let textGlowColor = ColorUtility.FromHex( this.textGlowColor ).toHexString( this.model.textGlowIntensity );
            shdw = shdw ? shdw + ',' : '';
            shdw += `0px 0px ${this.model.textGlowSize}px ${textGlowColor}, -1px -1px ${this.model.textGlowSize}px ${textGlowColor}, 1px -1px ${this.model.textGlowSize}px ${textGlowColor}, -1px 1px ${this.model.textGlowSize}px ${textGlowColor}, 1px 1px ${this.model.textGlowSize}px ${textGlowColor}`;
        }
        
        return shdw;
    }

    public get backgroundColor(): string {
        if ( this.model.backgroundTransparency > 0 && this.model.backgroundColor ) {
            let backgroundColor = ColorUtility.FromHex( this.model.backgroundColor ).toHexString( this.model.backgroundTransparency );
            return backgroundColor;
        } else {
            return null;
        }
    }

    public get border(): string {
        if ( this.model.borderTransparency > 0 && this.model.borderColor ) {
            let borderColor = ColorUtility.FromHex( this.model.borderColor ).toHexString( this.model.borderTransparency );
            return `3px solid ${borderColor}`;
        } else {
            return null;
        }
    }

    public get lineHeight(): string {
        return `${( this.model.lineHeight > 10 ? this.model.lineHeight : 90 ) / 100}em`;
    }

    public get previewFontColor(): string {
        if ( this.fontTransparency > 0 ) {
            return ColorUtility.FromHex( this.model.fontColor ).toHexString( this.fontTransparency / 100 );
        } else {
            return this.model.fontColor;
        }
        
    }

    @HostListener( 'window:beforeunload' ) doSomething() {
        this.ipcService.disableOverlayEditMode( this.overlayId );
    }

    constructor( private ipcService: IpcService, private route: ActivatedRoute, private dialog: MatDialog ) { }

    ngOnInit() {
        this.model = new OverlayWindowModel();

        this.route.params.subscribe( params => {
            
            this.overlayId = params[ 'id' ];

            if ( this.overlayId != null ) {
                this.ipcService.getOverlayWindow( this.overlayId ).subscribe( overlay => {
                    
                    this.ipcService.enableOverlayEditMode( this.overlayId );
                    this._noChangesModel = Object.assign( new OverlayWindowModel(), overlay );
                    this.model = overlay;
                    this.enterDescription = this.model.description?.length > 0;

                    this.model.fontFamily = this.model.fontFamily ? this.model.fontFamily : 'Roboto';
                    this.model.fontSize = this.model.fontSize > 0 ? this.model.fontSize : 14;
                    this.model.lineHeight = this.model.lineHeight > 0 ? this.model.lineHeight : 90;
                    this.model.fontWeight = this.model.fontWeight > 100 ? this.model.fontWeight : 400;
                    this.fontWeightIndex = availableFonts[ this.model.fontFamily ].indexOf( this.model.fontWeight );
                    this.fontTransparency = Math.round( this.model.fontTransparency * 100 );
                    this.backgroundTransparency = Math.round( this.model.backgroundTransparency * 100 );
                    this.borderTransparency = Math.round( this.model.borderTransparency * 100 );
                    this.textBorderColor = ColorUtility.FromHex( this.model.textBorderColor ).toHexString( 1 );
                    this.textGlowColor = ColorUtility.FromHex( this.model.textGlowColor ).toHexString( 1 );
                    this.textBorderIntensity = ColorUtility.FromHex( this.model.textBorderColor ).a * 100;
                    this.textGlowIntensity = ColorUtility.FromHex( this.model.textGlowColor ).a * 100;
                    this.dotGroupHeaderWeightIndex = availableFonts[ this.model.fontFamily ].indexOf( this.model.groupHeaderWeight );
                } );

                this.ipcService.overlayBoundsChanged().subscribe( e => {
                    if ( e.overlayId === this.overlayId ) {
                        this.model.x = e.bounds.x;
                        this.model.y = e.bounds.y;
                        this.model.windowWidth = e.bounds.width;
                        this.model.windowHeight = e.bounds.height;
                        this.model.displayBounds = e.displayBounds;
                        this.model.displayId = e.displayId;
                    }
                } );
            }
     
        } );
        
    }









    
    /**
     * Sets the font family and broadcasts the model.
     */
    public onChangeFontFamily(): void {
        let fi: number = availableFonts[ this.model.fontFamily ].indexOf( this.model.fontWeight );
        this.fontWeightIndex = -1;
        this.dotGroupHeaderWeightIndex = -1;

        if ( fi > -1 ) {
            this.fontWeightIndex = fi;
            this.dotGroupHeaderWeightIndex = fi;
        } else {

            for ( let i = 100; i < 500; i += 100 ) {
                let lfi: number = availableFonts[ this.model.fontFamily ].indexOf( this.model.fontWeight - i );
                let ufi: number = availableFonts[ this.model.fontFamily ].indexOf( this.model.fontWeight + i );
                if ( lfi > -1 ) {
                    this.fontWeightIndex = lfi;
                    this.dotGroupHeaderWeightIndex = lfi;
                    break;
                } else if ( ufi > -1 ) {
                    this.fontWeightIndex = ufi;
                    this.dotGroupHeaderWeightIndex = ufi;
                    break;
                }
            }
            
        }

        this.fontWeightIndex = this.fontWeightIndex > -1 ? this.fontWeightIndex : 0;
        this.dotGroupHeaderWeightIndex = this.dotGroupHeaderWeightIndex > -1 ? this.dotGroupHeaderWeightIndex : 0;

        this.broadcastModel();
    }









    
    /**
     * Sets the font border intensity and broadcasts the model.
     */
    public onChangeTextBorderIntensity(): void {
        this.model.textBorderIntensity = this.textBorderIntensity / 100;
        this.broadcastModel();
    }









    
    /**
     * Sets the text glow intensity and broadcasts the model.
     */
    public onChangeTextGlowIntensity(): void {
        this.model.textGlowIntensity = this.textGlowIntensity / 100;
        this.broadcastModel();
    }









    
    /**
     * Sets the font transparency and broadcasts the model.
     */
    public onChangeFontTransparency(): void {
        this.model.fontTransparency = this.fontTransparency / 100;
        this.broadcastModel();
    }









    
    /**
     * Sets the background transparency and broadcasts the model.
     */
    public onChangeBackgroundTransparency(): void {
        this.model.backgroundTransparency = this.backgroundTransparency / 100;
        this.broadcastModel();
    }









    
    /**
     * Sets the border transparency and broadcasts the model.
     */
    public onChangeBorderTransparency(): void {
        this.model.borderTransparency = this.borderTransparency / 100;
        this.broadcastModel();
    }









    
    /**
     * Sets the font color and broadcasts the model.
     */
    public onChangeFontColor(): void {
        this.model.fontColor = this.fontColor.toHex();
        this.broadcastModel();
    }









    
    /**
     * Broadcasts the model to the overlay.
     */
    public broadcastModel(): void {
        this.model.fontWeight = availableFonts[ this.model.fontFamily ][ this.fontWeightIndex ];
        this.model.groupHeaderWeight = availableFonts[ this.model.fontFamily ][ this.dotGroupHeaderWeightIndex ];
        this.model.textBorderColor = ColorUtility.FromHex( this.textBorderColor ).toHexString( this.model.textBorderIntensity );
        this.model.textGlowColor = ColorUtility.FromHex( this.textGlowColor ).toHexString( this.model.textGlowIntensity );
        this.ipcService.broadcastOverlayModel( this.model );
    }
    








    
    /**
     * Broadcasts the model to the overlay.
     * 
     * @param style The style that changed.
     */
    public styleChange( style: StylePropertiesModel ) {
        // TODO: Wat?
        this.broadcastModel();
    }









    
    /**
     * Cancels the overlay editor, reverting any changes made.
     */
    public cancel(): void {
        this.ipcService.updateOverlayWindow( this._noChangesModel ).subscribe( success => { } );
        this.closeModal();
    }









    
    /**
     * Closes the modal.
     */
    public closeModal(): void {
        this.ipcService.closeThisChild();
    }









    
    /**
     * Saves the overlay.
     */
    public save(): void {
        if ( this.overlayId == null ) {
            this.closeModal();
        } else {
            if ( this.model.timerColor?.length > 0 ) {
                this.model.timerBackgroundColor = ColorUtility.FromHex( this.model.timerColor ).darken( 0.93 ).toString( 0.75 );
            }
            this.ipcService.updateOverlayWindow( this.model ).subscribe( success => { } );
            this.closeModal();
        }
    }









    
    /**
     * Sends the overlay to the origin of the user selected display.
     */
    sendToOrigin() {
        this.dialog.open<MonitorSelectDialogComponent, any, number|null>( MonitorSelectDialogComponent, {
            width: '750px',
            data: {
                message: [ 'Select which monitor to move this overlay to.' ],
                displayId: this.model.displayId ?? null,
            },
            panelClass: 'app-dialog',
        } ).afterClosed().subscribe( displayId => {
            if ( displayId !== null ) {
                window.api.logger.info( `[OverlayEditor:sendToOrigin] Sending overlay ${this.overlayId} to display ${displayId}` );
                this.ipcService.sendOverlayToOrigin( this.overlayId, displayId );
            }
        } );
    }
    








    
    /**
     * Sends a test display text to the overlay.
     */
    public sendDisplayTextTest(): void {
        if ( this.model.overlayType === 'Timer' ) {
            let timers: any[] = [
                { name: 'Dot 01', triggerName: 'Dot 01', duration: 48, target: 'Mob 01', matches: { 0: '', 1: 'Mob 01', groups: { target: 'Mob 01' } }, delay: 0 * 1000, overrideTimerColor: '#CC5500', timerBackgroundColor: ColorUtility.FromHex( '#CC5500' ).darken( 0.93 ).toString( 0.75 ) },
                { name: 'Dot 02', triggerName: 'Dot 02', duration: 30, target: 'Mob 01', matches: { 0: '', 1: 'Mob 01', groups: { target: 'Mob 01' } }, delay: 2 * 1000, ifEndingSoon: true, endingDuration: 24, endingSoonChangeColor: true, endingSoonColor: '#800000', endingSoonBackgroundColor: ColorUtility.FromHex( '#800000' ).darken( 0.93 ).toString( 0.75 ) },
                { name: 'Dot 03', triggerName: 'Dot 03', duration: 54, target: 'Mob 01', matches: { 0: '', 1: 'Mob 01', groups: { target: 'Mob 01' } }, delay: 4 * 1000, overrideTimerColor: null, timerBackgroundColor: null },
                { name: 'Dot 04', triggerName: 'Dot 04', duration: 60, target: 'Mob 01', matches: { 0: '', 1: 'Mob 01', groups: { target: 'Mob 01' } }, delay: 6 * 1000, overrideTimerColor: null, timerBackgroundColor: null },
                { name: 'Dot 05', triggerName: 'Dot 05', duration: 48, target: 'Mob 02', matches: { 0: '', 1: 'Mob 02', groups: { target: 'Mob 02' } }, delay: 8 * 1000, overrideTimerColor: null, timerBackgroundColor: null },
                { name: 'Dot 06', triggerName: 'Dot 06', duration: 42, target: 'Mob 02', matches: { 0: '', 1: 'Mob 02', groups: { target: 'Mob 02' } }, delay: 10 * 1000, overrideTimerColor: null, timerBackgroundColor: null },
                { name: 'Dot 07', triggerName: 'Dot 07', duration: 36, target: 'Mob 02', matches: { 0: '', 1: 'Mob 02', groups: { target: 'Mob 02' } }, delay: 12 * 1000, overrideTimerColor: null, timerBackgroundColor: null },
                { name: 'Dot 08', triggerName: 'Dot 08', duration: 30, target: 'Mob 02', matches: { 0: '', 1: 'Mob 02', groups: { target: 'Mob 02' } }, delay: 14 * 1000, overrideTimerColor: null, timerBackgroundColor: null },
            ];
            timers.forEach( f => {
                let comp = {
                    instanceId: nanoid(),
                    triggerName: f.triggerName,
                    action: {
                        actionId: nanoid(),
                        displayText: `${f.name} --== {1} ==--`,
                        restartBehavior: TimerRestartBehaviors.RestartOnDuplicate,
                        duration: f.duration,
                        actionType: ActionTypes.DotTimer,
                        overrideTimerColor: f.overrideTimerColor,
                        timerBackgroundColor: f.timerBackgroundColor,
                        ifEndingSoon: f.ifEndingSoon,
                        endingDuration: f.endingDuration,
                        endingSoonChangeColor: f.endingSoonChangeColor,
                        endingSoonColor: f.endingSoonColor,
                        endingSoonBackgroundColor: f.endingSoonBackgroundColor,
                        timerIcon: 'data:image/png;base64,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',
                    },
                    overlayId: this.overlayId,
                    matches: f.matches,
                    timestamp: new Date(),
                };
                
                window.setTimeout( () => {
                    comp.timestamp = new Date();
                    this.ipcService.sendOverlayComponent( comp );
                }, f.delay );
            } );
        } else {
            let phrases: string[] = [
                'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
                'Vivamus viverra luctus nibh, porta consequat neque mattis a.',
                'Etiam mollis justo felis, non suscipit velit commodo sed.',
                'Maecenas lobortis mi sed felis scelerisque viverra.',
                'Phasellus nec nibh a nulla porttitor gravida.',
            ];
            phrases.forEach( phrase => {
                let comp: any = {
                    overlayId: this.overlayId,
                    action: {
                        actionType: ActionTypes.DisplayText,
                        duration: Math.floor(Math.random() * 5) + 10,
                        displayText: phrase,
                    }
                }
                this.ipcService.sendOverlayComponent( comp );
            } );
        }
    }










}
