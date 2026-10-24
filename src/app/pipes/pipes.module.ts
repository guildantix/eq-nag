import { NgModule } from '@angular/core';

import { SafeHtmlContentPipe } from './safe-html-content.pipe';
import { IconSrcPipe } from './icon-src.pipe';

@NgModule({
    imports: [],
    declarations: [
        SafeHtmlContentPipe,
        IconSrcPipe,
    ],
    exports: [
        SafeHtmlContentPipe,
        IconSrcPipe,
    ],
    providers: [],
})
export class PipesModule { }
