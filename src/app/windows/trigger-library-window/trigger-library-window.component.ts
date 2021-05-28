import { animate, state, style, transition, trigger } from '@angular/animations';
import { FlatTreeControl } from '@angular/cdk/tree';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { customAlphabet } from 'nanoid';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
import { MatSnackBar } from '@angular/material/snack-bar';
import { IpcService } from 'src/app/ipc.service';
import { DialogService } from 'src/app/dialogs/dialog.service';

@Component( {
    selector: 'app-trigger-library-window',
    templateUrl: 'trigger-library-window.component.html',
    styleUrls: [ 'trigger-library-window.component.scss', '../../core.scss', '../../modal.scss' ],
    animations: [
        trigger( 'detailExpand', [
            state( 'collapsed', style( { height: '0px', minHeight: '0' } ) ),
            state( 'expanded', style( { height: '*' } ) ),
            transition( 'expanded <=> collapsed', animate( '225ms cubic-bezier(0.4, 0.0, 0.2, 1)' ) ),
        ] ),
    ],
} )
export class TriggerLibraryWindowComponent implements OnInit {

    public loadingLibrary: boolean = true;

    constructor( private ipcService: IpcService, private dialogService: DialogService, private snackBar: MatSnackBar ) { }

    ngOnInit() {
        
    }

    public closeModal(): void {
        this.ipcService.closeThisChild();
    }

}
