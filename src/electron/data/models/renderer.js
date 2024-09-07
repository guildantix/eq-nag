const { OverlayComponent } = require( "./overlay-window" );
const { ActionTypes } = require( "./trigger" );

class RendererComponent {
    /** @type {string} */
    instanceId;
    /** @type {string} */
    triggerId;
    /** @type {string} */
    actionId;
    /** @type {ListObjectModel | OverlayComponent} */
    objectModel;
    /** @type {HTMLDivElement | undefined} The containing div element. */
    dom = undefined;
}

class ListItemModel {
    /** @type {string} */
    name;
    /** @type {string} */
    iconCssClass;
    /** @type {string} */
    textCssClass;
}

class ListObjectModel {
    /** @type {'background'|'no-background'} */
    listCssClass = 'background';
    /** @type {string} */
    listTitle = '';
    /** @type {number} */
    fontSize = 16;
    /** @type {number} */
    fontWeight = 400;
    /** @type {string} */
    fontFamily = 'Oswald';
    /** @type {ListItemModel[]} */
    items = [];
    /** @type {Electron.Rectangle | undefined} */
    bounds = undefined;
}

class RenderTokenModel {
    /** @type {string} */
    triggerId;
    /** @type {string} */
    actionId;
    /** @type {number} Uses the ActionTypes "enum"*/
    actionType;
    /** @type {ListObjectModel | OverlayComponent} */
    objectModel;
    /** @type {HTMLDivElement | undefined} The containing div element. */
    dom = undefined;
}

module.exports = {
    ListItemModel,
    ListObjectModel,
    RenderTokenModel,
    RendererComponent,
};
