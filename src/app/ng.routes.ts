import { TriggerDialogComponent } from './dialogs/trigger-dialog/trigger-dialog.component';
import { Routes } from '@angular/router';
import { MainComponent } from './main.component';
import { OverlayEditorDialogComponent } from './dialogs/overlay-editor-dialog/overlay-editor-dialog.component';
import { GinaImportWindowComponent } from './windows/gina-import-window/gina-import-window.component';
import { TriggerLibraryWindowComponent } from './windows/trigger-library-window/trigger-library-window.component';
import { MoveOverlaysDialogComponent } from './dialogs/move-overlays-dialog/move-overlays-dialog.component';
import { UpdateNotesWindowComponent } from './windows/update-notes-window/update-notes-window.component';
import { LogSimulatorComponent } from './windows/log-simulator/log-simulator.component';
import { EasyWindowComponent } from './windows/easy-window/easy-window.component';


// let secureRoutes: Routes = [
//     { path: 'dashboard', component: DashboardComponent },
//     // { path: 'user/new', component: NewUserComponent },
//     // { path: 'user/:id', component: UserDetailsComponent },
//     { path: 'users', component: UserListComponent },
//     { path: 'settings', component: SettingsComponent },
//     { path: 'settings/stem', component: StemSettingsComponent },
//     { path: 'theme', component: ThemeEditorComponent },
//     { path: 'product-categories', component: ProductCategoryListComponent },
//     { path: 'product-category/new', component: ProductCategoryNewComponent },
//     { path: 'product-category/:id', component: ProductCategoryDetailsComponent },
//     { path: 'products', component: ProductListComponent },
//     { path: 'product-dashboard', component: ProductDashboardComponent },
//     { path: 'product/new', component: ProductNewComponent },
//     { path: 'product/:id', component: ProductDetailsComponent },
//     { path: 'blogPosts', component: BlogPostListComponent },
//     { path: 'blogPost/new', component: BlogPostDetailsComponent },
//     { path: 'blogPost/:id', component: BlogPostDetailsComponent },
//     { path: 'gallery', component: GalleryListComponent },
//     { path: 'forms', component: FormsListComponent },
//     { path: 'form/new', component: FormNewComponent },
//     { path: 'form/:id', component: FormDetailsComponent },
//     { path: 'form-category', component: FormResponsesGroupComponent },
//     { path: 'form-responses/new', component: FormResponsesListNewComponent },
//     { path: 'form-responses/reviewed', component: FormResponsesListDoneComponent },
//     { path: 'form-response/:id', component: FormResponseDetailsComponent },
//     { path: 'form-payments', component: FormPaymentsListComponent },
//     { path: 'form-payment/:id', component: FormPaymentDetailsComponent },
//     { path: 'pages', component: PagesListComponent },
//     { path: 'pages/dashboard', component: PageDashboardComponent },
//     { path: 'page/new', component: NewPageComponent },
//     { path: 'page/:id', component: PageDetailsComponent },
//     { path: 'page/:id/editor', component: PageEditorComponent },
//     { path: 'page/:id/editor/version/:hash', component: PageEditorComponent },
//     { path: 'page/:id/version/:hash', component: PageDetailsComponent },
//     { path: 'menu', component: HierarchyComponent },
//     { path: 'events', component: EventListComponent },
//     { path: 'event/:id', component: EventDetailsComponent },
//     { path: 'event/new', component: EventDetailsComponent },
//     { path: 'websites', component: WebsiteListComponent },
//     { path: 'website/new', component: NewWebsiteComponent },
//     { path: 'website/:id', component: WebsiteDetailsComponent },
//     { path: 'integrations/g2w/registrants', component: GoToWebinarRegistrantsComponent },
//     { path: 'members', component: MembersListComponent },
//     { path: 'member/new', component: NewMemberComponent },
//     { path: 'member/:id', component: MemberDetailsComponent },
// ];

// let publicRoutes: Routes = [
//     { path: 'login', component: LoginComponent },
//     { path: 'logout', component: LogoutComponent },
//     { path: 'sign-up', component: SignUpComponent },
//     { path: 'sign-up/:id', component: SignUpComponent },
//     { path: 'email-verification/:id', component: EmailVerificationComponent },
//     { path: 'password-reset-request', component: RequestResetPasswordComponent },
//     { path: 'password-reset/:id', component: ResetPasswordComponent },
// ];

// let integrationRoutes: Routes = [
//     { path: 'integrations/g2w', component: G2wCallbackComponent },
// ];

let _routes: Routes = [
    { path: 'dashboard', component: MainComponent },
    { path: 'trigger/library', component: TriggerLibraryWindowComponent },
    { path: 'trigger/new', component: TriggerDialogComponent },
    { path: 'trigger/new/:folderId', component: TriggerDialogComponent },
    { path: 'trigger/:id', component: TriggerDialogComponent },
    { path: 'overlay/arrange', component: MoveOverlaysDialogComponent },
    { path: 'overlay/:id', component: OverlayEditorDialogComponent },
    { path: 'gina/import', component: GinaImportWindowComponent },
    { path: 'update-notes', component: UpdateNotesWindowComponent },
    { path: 'log/simulator', component: LogSimulatorComponent },
    { path: 'easy', component: EasyWindowComponent },
    // { path: '', redirectTo: '/users', pathMatch: 'full', canActivate: [ Guard ] }, // If the user is logged in, the Guard will allow the navigation and the user will be redirected to the user list.
    { path: '', redirectTo: '/dashboard', pathMatch: 'full' }, // If the user is not logged in, then the guard will not allow access (theoretically it should redirect the user, but) and this will redirect to the login page.
    // { path: '', component: SecureComponent, canActivate: [ Guard ], children: secureRoutes },
    // { path: '', component: IntegrationLayoutComponent, canActivate: [ Guard ], children: integrationRoutes },
    // { path: '', component: PublicComponent, children: publicRoutes }
];

export const appRoutes: Routes = _routes;
