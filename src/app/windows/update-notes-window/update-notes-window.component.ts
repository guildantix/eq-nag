import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IpcService } from 'src/app/ipc.service';

// 'https://api.github.com/repos/guildantix/eq-nag/releases/79376270';
// 'https://api.github.com/repos/guildantix/eq-nag/releases/tags/v0.2.0';
// 'https://api.github.com/repos/guildantix/eq-nag/releases/tags/v0.1.77';
// 'https://api.github.com/repositories/276931539/releases/latest';
// const releaseUrl: string = 'https://api.github.com/repos/guildantix/eq-nag/releases/tags/v0.1.77';
const releaseUrl: string = 'https://api.github.com/repos/guildantix/eq-nag/releases';

interface IReleaseInfo {
    html_url: string;
    published_at: Date;
    body: string;
    name: string;
}

@Component( {
    selector: 'app-update-notes-window',
    templateUrl: 'update-notes-window.component.html',
    styleUrls: [ './update-notes-window.component.scss', '../../core.scss', '../../modal.scss' ]
} )
export class UpdateNotesWindowComponent implements OnInit, AfterViewInit {

    public updateNotes: string;
    public updateLink: string;
    public updateTimestamp: Date;
    public versionNumber: string;
    
    public get showPatreonHeader(): boolean {
        let value = localStorage.getItem( 'notes_showPatreonHeader' );
        return value !== 'false';
    }
    public set showPatreonHeader( value: boolean ) {
        localStorage.setItem( 'notes_showPatreonHeader', value.toString() );
    }

    public showBottomPatreon: boolean = false;
    public showFooterPatreon: boolean = false;

    @ViewChild( 'updateNotesElement' ) updateNotesElement: ElementRef<HTMLDivElement>;

    @HostListener( 'window:wheel', [ '$event' ] ) onWheel( event: WheelEvent ) {
        // If the scroll height is zero, then do not show the footer patreon.
        // If the scroll height is greater than zero, and the user has scrolled to the bottom, then do not show the footer patreon.

        let element = this.updateNotesElement.nativeElement;
        let scrollHeight = element.scrollHeight - element.clientHeight;
        let scrollTop = element.scrollTop;

        this.showFooterPatreon = scrollHeight > 0 && scrollTop <= ( scrollHeight - 100 );
    }

    constructor(
        private httpClient: HttpClient,
        private readonly route: ActivatedRoute,
        private readonly ipcService: IpcService,
    ) {
        // If we're in dev mode, reset the showPatreonHeader value.
        this.ipcService.getAppIsDev().subscribe( isDev => {
            if ( isDev ) {
                localStorage.removeItem( 'notes_showPatreonHeader' );
            } else {
                this.showBottomPatreon = localStorage.getItem( 'notes_showPatreonHeader' ) === 'false';
            }
        } );
    }

    ngOnInit() {
        this.route.params.subscribe( params => {
            let tag = params[ 'tag' ] ? `tags/${params[ 'tag' ]}` : 'latest';

            this.httpClient.get<IReleaseInfo>( `${releaseUrl}/${tag}` ).subscribe( data => {
                this.updateNotes = data.body;
                this.updateLink = data.html_url;
                this.updateTimestamp = data.published_at;
                this.versionNumber = data.name;
            } );
        } );
    }

    ngAfterViewInit() {
        window.setTimeout( () => {
            this.showFooterPatreon = this.updateNotesElement.nativeElement.scrollHeight > this.updateNotesElement.nativeElement.scrollTop;
        }, 0 );
    }

    public close() {
        if ( this.versionNumber ) {
            window.api.setVersionNumberViewed( this.versionNumber );
        }
        window.api.close();
    }

    public openPatreon( event: MouseEvent ) {
        this.ipcService.openPatreon();
        event.preventDefault();
    }

}
