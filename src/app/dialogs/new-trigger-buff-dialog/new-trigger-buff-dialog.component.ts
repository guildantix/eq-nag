import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatHorizontalStepper } from '@angular/material/stepper';
import { ImportTypes, OverlayWindowModel, ScrapedSpell, TriggerModel } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { ScraperService } from 'src/app/scraper.service';
import { NewTriggerDialogModel } from '../dialog.model';

@Component( {
    selector: 'app-new-trigger-buff-dialog',
    templateUrl: 'new-trigger-buff-dialog.component.html',
    styleUrls: [ 'new-trigger-buff-dialog.component.scss', '../../core.scss', '../../modal.scss' ],
} )
export class NewTriggerBuffDialogComponent implements OnInit {
    
    public url: string;
    public overlays: OverlayWindowModel[] = [];
    public cancelTimerIfTargetDies: boolean = false;
    public useTimer: boolean = false;
    public alertWhenBuffFades: boolean = false;
    public alertWhenBuffOverwritten: boolean = false;
    public alertEndingSoon: boolean = false;
    public timerOverlayId: string;
    public endingSoonDuration: number = null;
    public readyForImport: boolean = false;
    
    public get timerOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Timer' );
    }
    
    @ViewChild( 'stepper', { static: false, read: MatHorizontalStepper } ) public stepper: MatHorizontalStepper;

    private spell: ScrapedSpell;
    
    constructor(
        public dialogRef: MatDialogRef<NewTriggerBuffDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: NewTriggerDialogModel,
        public scraper: ScraperService,
        public ipcService: IpcService,
        public dialog: MatDialog ) { }

    ngOnInit() {
        this.ipcService.getOverlayWindows().subscribe( overlays => this.overlays = overlays );
    }

    public scrape(): void {
        this.scraper.ScrapeAllakhazamSpell( this.url ).subscribe( spell => {
            this.spell = spell;
            this.stepper.next();
        } );
    }

    public import(): void {

        let trigger: TriggerModel;

        if ( this.data?.trigger?.triggerId != null ) {
            trigger = this.data.trigger;
        } else {
            trigger = new TriggerModel();
            trigger.comments = `Buff timer ${this.spell.name}.`;
        }

        trigger.name = this.spell.name;
        trigger.classLevels = this.spell.classes;
        trigger.allakhazamUrl = this.url;
        trigger.captureMethod = 'Sequential';
        trigger.importType = ImportTypes.Buff;

    }

}
