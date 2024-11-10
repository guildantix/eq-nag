import { NgModule } from '@angular/core';

import { SafeHtmlContentPipe } from './safe-html-content.pipe';

@NgModule({
    imports: [],
    declarations: [
        SafeHtmlContentPipe,
    ],
    exports: [
        SafeHtmlContentPipe,
    ],
    providers: [],
})
export class PipesModule { }
