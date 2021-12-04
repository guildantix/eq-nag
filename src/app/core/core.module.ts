import { ErrorHandler, NgModule } from '@angular/core';
import { GlobalErrorHandler } from './global-error-handler';
import { HorizontalScrollDirective } from './horizontal-scroll.directive';

@NgModule( {
    imports: [

    ],
    exports: [
        HorizontalScrollDirective
    ],
    declarations: [
        HorizontalScrollDirective
    ],
    providers: [ {
        provide: ErrorHandler,
        useClass: GlobalErrorHandler,
    } ],
} )
export class CoreModule { }
