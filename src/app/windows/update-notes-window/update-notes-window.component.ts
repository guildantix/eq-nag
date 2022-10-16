import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';

// 'https://api.github.com/repos/guildantix/eq-nag/releases/79376270';
const releaseUrl: string = 'https://api.github.com/repositories/276931539/releases/latest'; 

interface IReleaseInfo {
    html_url: string;
    published_at: Date;
    body: string;
    name: string;
}

declare let browserWindow: {
    close(): void;
    setVersionNumberViewed(value: string): void;
};

@Component( {
    selector: 'app-update-notes-window',
    templateUrl: 'update-notes-window.component.html',
    styleUrls: [ './update-notes-window.component.scss', '../../core.scss', '../../modal.scss' ]
} )
export class UpdateNotesWindowComponent implements OnInit {

    public updateNotes: string;
    public updateLink: string;
    public updateTimestamp: Date;
    public versionNumber: string;

    constructor(
        private httpClient: HttpClient,
    ) { }

    ngOnInit() {
        this.httpClient.get<IReleaseInfo>( releaseUrl ).subscribe( data => {
            this.updateNotes = data.body;
            this.updateLink = data.html_url;
            this.updateTimestamp = data.published_at;
            this.versionNumber = data.name;
        } );
    }

    public close() {
        browserWindow.setVersionNumberViewed( this.versionNumber );
        browserWindow.close();
    }

}
