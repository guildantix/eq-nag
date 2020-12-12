import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { ContextService } from 'src/app/context-menu/context.service';
import { FileModel, OverlayWindowModel, Phrase, TriggerAction } from 'src/app/core.model';
import { customAlphabet } from 'nanoid';
import { IpcService } from 'src/app/ipc.service';
import { DialogService } from 'src/app/dialogs/dialog.service';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

@Component( {
    selector: 'app-trigger-action-audio',
    templateUrl: 'trigger-action-audio.component.html',
    styleUrls: [ 'trigger-action-audio.component.scss', '../../core.scss', '../../modal.scss' ]
} )
export class TriggerActionAudioComponent implements OnInit {
    
    public audioFiles: FileModel[] = [];
    @Input( 'action' ) public action: TriggerAction;
    @ViewChild( 'audioFileSelector' ) private audioFileSelector: ElementRef<HTMLInputElement>;

    @Output('change') public onChange: EventEmitter<string> = new EventEmitter<string>();

    private _audioFileSelected: ( e: any ) => void = null;

    constructor( private ipcService: IpcService, private dialogService: DialogService, private contextService: ContextService ) { }

    ngOnInit() {
        this.ipcService.getAudioFiles().subscribe( files => this.audioFiles = files );
    }

    public openAudioFileModal() {
        this._audioFileSelected = e => {
            this.ipcService
                .saveAudioFile( this.audioFileSelector.nativeElement.files[ 0 ] )
                .subscribe( fileId => {
                    this.ipcService.getAudioFiles().subscribe( files => {
                        this.audioFiles = files;
                        this.action.audioFileId = fileId;
                        this.onChange.emit( fileId );
                    } );
                } );
        };
        this.audioFileSelector.nativeElement.click();
    }

    public onAudioFileSelected( e: any ) {
        this._audioFileSelected( e );
        this._audioFileSelected = null;
    }

    public playSelectedAudioFile(): void {
        if ( this.action.audioFileId ) {

            this.ipcService.getAudioFileUrl( this.action.audioFileId ).subscribe( url => {
                if ( url ) {
                    let player = new Audio( url );
                    player.play();
                }
            } );
            
        }
    }
    
}