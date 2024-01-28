import { ErrorHandler, NgModule } from '@angular/core';
import { GlobalErrorHandler } from './global-error-handler';
import { HorizontalScrollDirective } from './horizontal-scroll.directive';
import { QuickShareService } from './quick-share.service';
import { NgVar } from './ng-var.directive';
import { ResizeableDirective } from './resizeable.directive';

@NgModule( {
    imports: [

    ],
    exports: [
        HorizontalScrollDirective,
        NgVar,
        ResizeableDirective,
    ],
    declarations: [
        HorizontalScrollDirective,
        NgVar,
        ResizeableDirective,
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
