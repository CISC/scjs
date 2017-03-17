declare module scjs {
    class ConManager {
        /**
         * A simple interface to Scala Content Manager web-services.
         *
         * This module is loosely modelled after the scws2 Python module, supporting the 2.x REST API.
         *
         * Example usage (set DEBUG=scjs for debug output):
         *
         * var scjs = require('scjs');
         *
         * var baseurl = "http://localhost/ContentManager";
         * var username = "user";
         * var password = "pass";
         * var cm = new scjs.ConManager(baseurl);
         * cm.login(username, password).then((resp) => {
         *     cm.get('players', { 'limit': 0, 'offset': 0, 'fields': 'id,name,enabled,active,type' }).then((players) => {
         *         console.log(players.list);
         *     });
         *     cm.get('media', { 'limit': 10, 'filters': '{"type":{"values":["IMAGE"]}}' }).then((media) => {
         *         var p = Promise.resolve();
         *         media.list.forEach((item) => {
         *             p = p.then(cm.download(item.downloadPath, item.name));
         *         });
         *     });
         *     cm.upload('LocalFolder/MyPicture.jpg', 'RemoteFolder/MyPicture.jpg').then((item) => {
         *         console.log(item);
         *     });
         * }).catch((e) => {
         *     console.log(e);
         * });
         *
         * @param {string} baseurl - URL to Content Manager (http://server/ContentManager)
         * @param {string} token_name - (optional) Alternative token name, mainly for older (<10.2) Content Manager releases where token had a different name (token)
         * @return {function}
         * @api public
         */
        constructor(baseurl: string, token_name?: string);

        /**
         * Upload a Stream to Content Manager.
         *
         * @param {stream.Readable} rstream - Readable Stream
         * @param {string} cmpath - Relative path to file on Content Manager
         * @param {string} upload_type - (optional) Type of file upload (media_item|maint_item|auto) (defaults to auto)
         * @return {Promise}
         * @api public
         */
        uploadStream(rstream: NodeJS.ReadableStream, cmpath: string, upload_type?: string): Promise<any>;

        /**
         * Upload file to Content Manager.
         *
         * @param {string} file - Full path to local file
         * @param {string} cmpath - (optional) Relative path to file on Content Manager
         * @param {string} upload_type - (optional) Type of file upload (media_item|maint_item|auto) (defaults to auto)
         * @return {Promise}
         * @api public
         */
        upload(file: string, cmpath?: string, upload_type?: string): Promise<any>;

        /**
         * Download file from Content Manager as a Stream.
         *
         * @param {string} cmpath - Relative path to file on Content Manager
         * @return {stream.Readable}
         * @api public
         */
        downloadStream(cmpath: string): NodeJS.ReadableStream;

        /**
         * Download file from Content Manager.
         *
         * @param {string} cmpath - Relative path to file on Content Manager
         * @param {string} file - Local filename to store downloaded content in
         * @return {Promise}
         * @api public
         */
        download(cmpath: string, file: string): Promise<any>;

        /**
         * Log in to Content Manager (will automatically log out previously logged in user).
         *
         * @param {string} username
         * @param {string} password
         * @return {Promise}
         * @api public
         */
        login(username: string, password: string): Promise<any>;

        /**
         * API GET request.
         *
         * @param {string} endpoint - Endpoint path
         * @param {Object} data - Parameters
         * @return {Promise}
         * @api public
         */
        get(endpoint: string, data: any): Promise<any>;

        /**
         * API POST request.
         *
         * @param {string} endpoint - Endpoint path
         * @param {Object} data - Parameters
         * @return {Promise}
         * @api public
         */
        post(endpoint: string, data: any): Promise<any>;

        /**
         * API PUT request.
         *
         * @param {string} endpoint - Endpoint path
         * @param {Object} data - Parameters
         * @return {Promise}
         * @api public
         */
        put(endpoint: string, data: any): Promise<any>;

        /**
         * API DELETE request.
         *
         * @param {string} endpoint - Endpoint path
         * @param {Object} data - Parameters
         * @return {Promise}
         * @api public
         */
        delete(endpoint: string, data: any): Promise<any>;

        /**
         * Cached login response object.
         * @public
         */
        login_response: any;
    }
}

export = scjs;
