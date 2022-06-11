import { ErrorHandler, NgModule } from '@angular/core';
import { GlobalErrorHandler } from './global-error-handler';
import { HorizontalScrollDirective } from './horizontal-scroll.directive';
import { QuickShareService } from './quick-share.service';

@NgModule( {
    imports: [

    ],
    exports: [
        HorizontalScrollDirective
    ],
    declarations: [
        HorizontalScrollDirective
    ],
    providers: [
        {
            provide: ErrorHandler,
            useClass: GlobalErrorHandler,
        },
        QuickShareService
    ],
} )
export class CoreModule { }
