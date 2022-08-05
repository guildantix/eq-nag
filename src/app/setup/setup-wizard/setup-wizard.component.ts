import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { MatDialogRef, MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatStepper } from '@angular/material/stepper';
import { Size } from 'electron';
import { CharactersListComponent } from 'src/app/characters-list/characters-list.component';
import { OverlayWindowModel, Point, Rectangle } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { customAlphabet } from 'nanoid';
import { forkJoin, Observable, timer } from 'rxjs';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

@Component( {
    selector: 'app-setup-wizard',
    templateUrl: 'setup-wizard.component.html',
    styleUrls: [ 'setup-wizard.component.scss' ]
} )
export class SetupWizardComponent implements OnInit {

    public enableFct: boolean = false;
    public groupedTimers: boolean = null;
    public get onLastStep(): boolean {
        return this.stepper?.selectedIndex > 0 && this.stepper?.selectedIndex === this.stepper?.steps.length - 1;
    }

    private _displaySize: Size = null;

    private _fctOutId: string;
    private _fctInId: string;
    private _detrimentalId: string;
    private _benficialId: string;
    private _alertId: string;

    @ViewChild( 'stepper', { static: false, read: MatStepper } ) public stepper: MatStepper;
    
    constructor(
        public dialogRef: MatDialogRef<SetupWizardComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: {},
        public dialog: MatDialog,
        private ipcService: IpcService ) {
        
    }

    ngOnInit() {
        
        this.ipcService.getPrimaryDisplay().subscribe( display => {
            this._displaySize = display.size;
        } );

        this.ipcService.getDetrimentalOverlayId().subscribe( id => this._detrimentalId = id );
        this.ipcService.getBeneficialOverlayId().subscribe( id => this._benficialId = id );
        this.ipcService.getAlertOverlayId().subscribe( id => this._alertId = id );
        this.ipcService.getDamageDealtOverlayId().subscribe( id => this._fctOutId = id );
        this.ipcService.getDamageReceivedOverlayId().subscribe( id => this._fctInId = id );

    }

    next() {

        if ( this.stepper.selected?.label === 'Overlays' ) {
            // Now we can create our default overlays.
            // And 'close' is good enough, in regards to default overlay positions.  I expect most people to move them after created.
            let standardVerticalRatio = 1080 / 300;
            let standardVertical = Math.round( this._displaySize.height / standardVerticalRatio );
            let tallVerticalRatio = 1080 / 500;
            let tallVertical = Math.round( this._displaySize.height / tallVerticalRatio );

            let detrimentalBounds: Rectangle = new Rectangle( 1, 1, this._displaySize.width * 0.25, standardVertical );
            let beneficialBounds: Rectangle = new Rectangle( this._displaySize.width - ( this._displaySize.width * 0.25 ), 1, this._displaySize.width * 0.25 - 1, standardVertical );
            let fctOutBounds: Rectangle = new Rectangle( 1, standardVertical, this._displaySize.width * 0.25, tallVertical );
            let fctInBounds: Rectangle = new Rectangle( this._displaySize.width - ( this._displaySize.width * 0.25 ), standardVertical, this._displaySize.width * 0.25, tallVertical );
            let textBounds: Rectangle = new Rectangle( this._displaySize.width * 0.2, 150, this._displaySize.width - ( this._displaySize.width * .2 ) * 2, standardVertical );

            let detrimentalOveraly = Object.assign( new OverlayWindowModel(), <OverlayWindowModel>{
                overlayId: nanoid(),
                windowHeight: detrimentalBounds.height,
                windowWidth: detrimentalBounds.width,
                x: detrimentalBounds.x,
                y: detrimentalBounds.y,
                name: 'Detrimental Timers',
                overlayType: 'Timer',
                fontFamily: 'Roboto',
                fontSize: 12,
                lineHeight: 100,
                fontWeight: 500,
                fontColor: '#ffffff',
                fontTransparency: 1,
                backgroundColor: '#000000',
                backgroundTransparency: 0,
                borderColor: '#000000',
                borderTransparency: 0,
                timerSortType: 1,
                timerColor: '#008000',
                showTextBorder: false,
                textBorderColor: '#000000',
                textBorderIntensity: 1,
                showTextGlow: false,
                textGlowColor: '#000000',
                textGlowIntensity: 1,
                textGlowSize: 10,
                groupByTarget: this.groupedTimers,
                groupHeaderSize: 14,
                groupHeaderWeight: 700,
                groupHeaderColor: '#f57f17',
                showTimeRemaining: true,
                hideTargetLabel: false
            } );
            let beneficialOverlay = Object.assign( new OverlayWindowModel(), <OverlayWindowModel>{
                overlayId: nanoid(),
                windowHeight: beneficialBounds.height,
                windowWidth: beneficialBounds.width,
                x: beneficialBounds.x,
                y: beneficialBounds.y,
                name: 'Beneficial Timers',
                overlayType: 'Timer',
                fontFamily: 'Roboto',
                fontSize: 12,
                lineHeight: 100,
                fontWeight: 500,
                fontColor: '#ffffff',
                fontTransparency: 1,
                backgroundColor: '#000000',
                backgroundTransparency: 0,
                borderColor: '#000000',
                borderTransparency: 0,
                timerSortType: 1,
                timerColor: '#008000',
                showTextBorder: false,
                textBorderColor: '#000000',
                textBorderIntensity: 1,
                showTextGlow: false,
                textGlowColor: '#000000',
                textGlowIntensity: 1,
                textGlowSize: 10,
                groupByTarget: false,
                groupHeaderSize: 14,
                groupHeaderWeight: 700,
                groupHeaderColor: '#ffffff',
                showTimeRemaining: true,
                hideTargetLabel: false
            } );
            let textOverlay = Object.assign( new OverlayWindowModel(), <OverlayWindowModel>{
                overlayId: nanoid(),
                windowHeight: textBounds.height,
                windowWidth: textBounds.width,
                x: textBounds.x,
                y: textBounds.y,
                name: 'Text Notifications',
                overlayType: 'Alert',
                fontFamily: 'Roboto',
                horizontalAlignment: 'center',
                verticalAlignment: 'bottom',
                fontSize: 18,
                lineHeight: 90,
                fontWeight: 700,
                fontColor: '#ffffff',
                fontTransparency: 1,
                backgroundColor: '#000000',
                backgroundTransparency: 0,
                borderColor: '#000000',
                borderTransparency: 0,
                timerSortType: 1,
                timerColor: '#008000',
                showTextBorder: true,
                textBorderColor: '#000000',
                textBorderIntensity: 1,
                showTextGlow: true,
                textGlowColor: '#000000',
                textGlowIntensity: 1,
                textGlowSize: 4,
                groupByTarget: false,
                groupHeaderSize: 40,
                groupHeaderWeight: 400,
                groupHeaderColor: '#ffffff',
                showTimeRemaining: false,
                hideTargetLabel: false
            } );
            let fctOutOverlay: OverlayWindowModel;
            let fctInOverlay: OverlayWindowModel;

            let creates: Observable<any>[] = [ timer( 1 ) ];

            if ( !this._detrimentalId ) {
                this._detrimentalId = detrimentalOveraly.overlayId;
                creates.push( this.ipcService.createNewOverlayWindow( detrimentalOveraly ) );
            }
            if ( !this._benficialId ) {
                this._benficialId = beneficialOverlay.overlayId;
                creates.push( this.ipcService.createNewOverlayWindow( beneficialOverlay ) );
            }
            if ( !this._alertId ) {
                this._alertId = textOverlay.overlayId;
                creates.push( this.ipcService.createNewOverlayWindow( textOverlay ) );
            }

            if ( this.enableFct ) {
                
                fctOutOverlay = Object.assign( new OverlayWindowModel(), <OverlayWindowModel>{
                    overlayId: nanoid(),
                    windowHeight: fctOutBounds.height,
                    windowWidth: fctOutBounds.width,
                    x: fctOutBounds.x,
                    y: fctOutBounds.y,
                    name: 'FCT My Damage',
                    overlayType: 'FCT',
                    fontFamily: 'Roboto',
                    horizontalAlignment: 'center',
                    verticalAlignment: 'bottom',
                    fontSize: 32,
                    lineHeight: 90,
                    fontWeight: 700,
                    fontColor: '#ffffff',
                    fontTransparency: 1,
                    backgroundColor: '#000000',
                    backgroundTransparency: 0,
                    borderColor: '#000000',
                    borderTransparency: 0,
                    timerSortType: 0,
                    timerColor: '#008000',
                    showTextBorder: false,
                    textBorderColor: '#000000',
                    textBorderIntensity: 1,
                    showTextGlow: false,
                    textGlowColor: '#000000',
                    textGlowIntensity: 1,
                    textGlowSize: 10,
                    groupByTarget: false,
                    groupHeaderSize: 40,
                    groupHeaderWeight: 400,
                    groupHeaderColor: '#ffffff',
                    showTimeRemaining: false,
                    hideTargetLabel: false
                } );
                fctInOverlay = Object.assign( new OverlayWindowModel(), <OverlayWindowModel>{
                    overlayId: nanoid(),
                    windowHeight: fctInBounds.height,
                    windowWidth: fctInBounds.width,
                    x: fctInBounds.x,
                    y: fctInBounds.y,
                    name: 'FCT Damage to Me',
                    overlayType: 'FCT',
                    fontFamily: 'Roboto',
                    horizontalAlignment: 'center',
                    verticalAlignment: 'bottom',
                    fontSize: 32,
                    lineHeight: 90,
                    fontWeight: 700,
                    fontColor: '#b71c1c',
                    fontTransparency: 1,
                    backgroundColor: '#000000',
                    backgroundTransparency: 0,
                    borderColor: '#000000',
                    borderTransparency: 0,
                    timerSortType: 0,
                    timerColor: '#008000',
                    showTextBorder: false,
                    textBorderColor: '#000000',
                    textBorderIntensity: 1,
                    showTextGlow: false,
                    textGlowColor: '#000000',
                    textGlowIntensity: 1,
                    textGlowSize: 10,
                    groupByTarget: false,
                    groupHeaderSize: 40,
                    groupHeaderWeight: 400,
                    groupHeaderColor: '#ffffff',
                    showTimeRemaining: false,
                    hideTargetLabel: false
                } );

                if ( !this._fctOutId ) {
                    this._fctOutId = fctOutOverlay.overlayId;
                    creates.push( this.ipcService.createNewOverlayWindow( fctOutOverlay ) );
                }
                if ( !this._fctInId ) {
                    this._fctInId = fctInOverlay.overlayId;
                    creates.push( this.ipcService.createNewOverlayWindow( fctInOverlay ) );
                }
            }

            forkJoin( creates ).subscribe( () => {

                this.ipcService.updateEnableFct( this.enableFct );
                
                this.ipcService.saveDetrimentalOverlayId( this._detrimentalId );
                this.ipcService.saveBeneficialOverlayId( this._benficialId );
                this.ipcService.saveAlertOverlayId( this._alertId );
                this.ipcService.saveDamageDealtOverlayId( this._fctOutId );
                this.ipcService.saveDamageReceivedOverlayId( this._fctInId );

                this.ipcService.showArrangeOverlaysDialog();

                this.stepper.next();
            } );
            
        } else {
            this.stepper.next();
            
        }
        
    }

    previous() {
        this.stepper.previous();
    }

    complete() {
        console.log( 'why no complete?' );
        this.ipcService.saveSetupCompleted( true );
        this.dialogRef.close( true );
    }
}
