import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

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
export class UpdateNotesWindowComponent implements OnInit {

    public updateNotes: string;
    public updateLink: string;
    public updateTimestamp: Date;
    public versionNumber: string;

    constructor(
        private httpClient: HttpClient,
        private readonly route: ActivatedRoute,
    ) {
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

    public close() {
        if ( this.versionNumber ) {
            window.api.setVersionNumberViewed( this.versionNumber );
        }
        window.api.close();
    }

}
