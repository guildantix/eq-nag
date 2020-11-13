import { Component, OnInit, Inject, ElementRef, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ActionTypes, CapturePhrase, OperatorTypes, OverlayWindowModel, TimerSortTypes, TriggerAction, TriggerCondition, TriggerConditionTypes, TriggerModel } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { ScraperService } from 'src/app/scraper.service';
import { customAlphabet } from 'nanoid';
// import { NgForm } from '@angular/forms';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

@Component( {
    selector: 'app-new-character-dialog',
    templateUrl: 'new-character-dialog.component.html',
    styleUrls: [ 'new-character-dialog.component.scss' ]
} )
export class NewCharacterDialogComponent implements OnInit {

    public url: string;
    public eqFolder: string = undefined;

    @ViewChild( 'fileSelector' ) private fileSelector: ElementRef<HTMLInputElement>;

    constructor(
        public dialogRef: MatDialogRef<NewCharacterDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: any,
        public ipcService: IpcService ) { }

    ngOnInit(): void {
        this.ipcService.getEqInstallFolder().subscribe( folder => { this.eqFolder = folder; console.log( 'folder found', folder ); } );
    }

    create(): void {

    }

    showFileSelector() {
        this.fileSelector.nativeElement.click();
    }

    fileSelected( e: any ) {
        console.log( 'testing', this.fileSelector.nativeElement.files[ 0 ].path );
        // this.ipcService.updateLogFile( this.fileSelector.nativeElement.files[ 0 ].path );
    }
    
}
