/***
 * MIT License
 *
 * Copyright (c) 2016 Scala Nordic AS
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

'use strict';

const debug = require('debug')('scjs');
const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const stream = require('stream');
const querystring = require('querystring');

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
function ConManager(baseurl, token_name) {
    this._request = (method, endpoint, data) => {
        let headers = { 'Content-Type': 'application/json' };

        if (this._token) {
            headers[this._token_name] = this._token;
        }

        if (['GET', 'HEAD', 'DELETE'].indexOf(method) >= 0) {
            if (data) {
                endpoint += `?${querystring.stringify(data)}`;
            }
        } else {
            if (data) {
                data = JSON.stringify(data);
                headers['Content-Length'] = Buffer.byteLength(data);
            } else {
                headers['Content-Length'] = 0;
            }
        }

        let options = {
            'hostname': this._baseurl.hostname,
            'port': this._baseurl.port,
            'path': url.resolve(this._baseurl.path, endpoint),
            'method': method,
            'headers': headers
        };

        debug("%s %s\n    %s\n", options.method, options.path, data);
        debug("----------------------------------------");

        return new Promise((resolve, reject) => {
            let http_call = this._baseurl.protocol == 'https:' ? https : http;
            let req = http_call.request(options, (res) => {
                let resp = '';

                debug("HTTP %s %s\n    %j\n", res.statusCode, res.statusMessage, res.headers);

                res.setEncoding('utf-8');
                res.on('data', (chunk) => {
                    resp += chunk;
                });
                res.on('end', () => {
                    if (resp) {
                        try {
                            resp = JSON.parse(resp);
                        } catch (e) {
                            if (e instanceof SyntaxError) {
                                resp = { 'httpErrorCode': res.statusCode, 'code': res.statusMessage, 'description': resp };
                                res.statusCode = 500;
                            } else {
                                throw e;
                            }
                        }
                    }

                    debug(resp);
                    debug("==================================================");

                    if (resp && typeof resp === 'object' && 'httpErrorCode' in resp && resp.httpErrorCode == 401 && resp.code == 'NoUserLogon') {
                        debug("Auth token has expired, logging in...");
                        this._oldtoken = null;
                        this._token = null;

                        this.login(this._username, this._password).then(() => {
                            headers[this._token_name] = this._token;

                            let nreq = http_call.request(options, (nres) => {
                                let nresp = '';

                                debug("HTTP %s %s\n    %j\n", nres.statusCode, nres.statusMessage, nres.headers);

                                nres.setEncoding('utf-8');
                                nres.on('data', (chunk) => {
                                    nresp += chunk;
                                });
                                nres.on('end', () => {
                                    if (nresp) {
                                        try {
                                            nresp = JSON.parse(nresp);
                                        } catch (e) {
                                            if (e instanceof SyntaxError) {
                                                nresp = { 'httpErrorCode': nres.statusCode, 'code': nres.statusMessage, 'description': nresp };
                                                nres.statusCode = 500;
                                            } else {
                                                throw e;
                                            }
                                        }
                                    }

                                    debug(nresp);
                                    debug("==================================================");

                                    if (nres.statusCode >= 400) {
                                        reject(nresp);
                                    } else {
                                        resolve(nresp);
                                    }
                                });
                            });
                            nreq.on('error', (e) => {
                                reject(e);
                            });

                            if (['GET', 'HEAD', 'DELETE'].indexOf(method) < 0 && data) {
                                nreq.write(data);
                            }
                            nreq.end();
                        }).catch((e) => {
                            reject(e);
                        });
                    } else if (res.statusCode >= 400) {
                        reject(resp);
                    } else {
                        resolve(resp);
                    }
                });
            });
            req.on('error', (e) => {
                reject(e);
            });

            if (['GET', 'HEAD', 'DELETE'].indexOf(method) < 0 && data) {
                req.write(data);
            }
            req.end();
        });
    };

    /**
     * Upload a Stream to Content Manager.
     *
     * @param {stream.Readable} rstream - Readable Stream
     * @param {string} cmpath - Relative path to file on Content Manager
     * @param {string} upload_type - (optional) Type of file upload (media_item|maint_item|auto) (defaults to auto)
     * @return {Promise}
     * @api public
     */
    this.uploadStream = (rstream, cmpath, upload_type) => {
        let filename = path.basename(cmpath);
        let subfolder = path.dirname(cmpath);
        let size = 0;

        if (subfolder == '.')
            subfolder = '';

        if (typeof upload_type === 'undefined')
            upload_type = 'auto';
        else
            upload_type = upload_type.toLowerCase();

        if (upload_type == 'auto') {
            if (['.bat', '.cmd', '.py', '.vbs', '.exe', '.zip'].indexOf(path.extname(filename)) >= 0)
                upload_type = 'maint_item';
            else
                upload_type = 'media_item';
        }

        // Unfortunately Content Manager doesn't support Transfer-Encoding: chunked
        // so try to detect length of Stream upfront
        if (rstream.hasOwnProperty('fd')) {
            size = fs.statSync(rstream.path).size;
        } else if (rstream.hasOwnProperty('httpVersion') && rstream.headers['content-length']) {
            size = parseInt(rstream.headers['content-length']);
        }

        debug("Uploading %s to %s as %s...", filename, subfolder ? subfolder : '(root)', upload_type);

        return this.post('fileupload/init', { 'filename': filename, 'filepath': subfolder, 'uploadType': upload_type }).then((resp_init) => {
            debug("    %s - %s", resp_init.uuid, resp_init.filename);

            return new Promise((resolve, reject) => {
                let http_call = this._baseurl.protocol == 'https:' ? https : http;
                let upload_chunk = (off, siz, uuid, success, error) => {
                    let headers = { 'Content-Type': 'application/octet-stream', 'Content-Length': siz };

                    if (this._token) {
                        headers[this._token_name] = this._token;
                    }

                    let options = {
                        'hostname': this._baseurl.hostname,
                        'port': this._baseurl.port,
                        'path': url.resolve(this._baseurl.path, `fileupload/part/${uuid}/${off}`),
                        'method': 'PUT',
                        'headers': headers
                    };

                    debug("%s %s\n", options.method, options.path);
                    debug("----------------------------------------");

                    return http_call.request(options, (res) => {
                        debug("HTTP %s %s\n    %j\n", res.statusCode, res.statusMessage, res.headers);

                        res.resume();
                        res.on('end', () => {
                            if (res.statusCode >= 300) {
                                error(res);
                            } else {
                                success(res);
                            }
                        });
                    }).on('error', reject);
                };

                if (size > 0) {
                    // Upload everything in one go if we know the length of the Stream
                    let req = upload_chunk(0, size, resp_init.uuid, (res) => {
                        this.post(`fileupload/complete/${resp_init.uuid}`).then(() => {
                            resolve(resp_init);
                        }).catch(reject);
                    }, (err) => {
                        let error = new Error(err.statusMessage);
                        error.code = err.statusCode;

                        this.delete(`media/${resp_init.mediaId}`).then(() => {
                            reject(error);
                        }).catch(reject);
                    });

                    rstream.on('error', reject).pipe(req).on('error', reject);
                } else {
                    // Upload each chunk in the Stream individually if we don't know the length
                    let offset = 0;

                    rstream.on('data', (chunk) => {
                        let req = upload_chunk(offset, chunk.byteLength, resp_init.uuid, (res) => {
                        }, (err) => {
                            let error = new Error(err.statusMessage);
                            error.code = err.statusCode;

                            rstream.pause();
                            this.delete(`media/${resp_init.mediaId}`).then(() => {
                                reject(error);
                            }).catch(reject);
                        });

                        req.write(chunk);

                        offset += chunk.byteLength;
                    }).on('end', () => {
                        this.post(`fileupload/complete/${resp_init.uuid}`).then(() => {
                            resolve(resp_init);
                        }).catch(reject);
                    }).on('error', (err) => {
                        this.delete(`media/${resp_init.mediaId}`).then(() => {
                            reject(err);
                        }).catch(reject);
                    });
                }
            });
        });
    };

    /**
     * Upload file to Content Manager.
     *
     * @param {string} file - Full path to local file
     * @param {string} cmpath - (optional) Relative path to file on Content Manager
     * @param {string} upload_type - (optional) Type of file upload (media_item|maint_item|auto) (defaults to auto)
     * @return {Promise}
     * @api public
     */
    this.upload = (file, cmpath, upload_type) => {
        let f = fs.createReadStream(file);

        if (typeof cmpath === 'undefined')
            cmpath = path.basename(file);

        return this.uploadStream(f, cmpath, upload_type);
    };

    /**
     * Download file from Content Manager as a Stream.
     *
     * @param {string} cmpath - Relative path to file on Content Manager
     * @return {stream.Readable}
     * @api public
     */
    this.downloadStream = (cmpath) => {
        let headers = {};
        let urlpath = url.parse(url.resolve(this._rooturl, cmpath.startsWith('/') ? cmpath.slice(1): cmpath));
        let http_call = urlpath.protocol == 'https:' ? https : http;
        let pt = new stream.PassThrough();

        if (this._token) {
            headers[this._token_name] = this._token;
        }

        let options = {
            'hostname': urlpath.hostname,
            'port': urlpath.port,
            'path': urlpath.path,
            'method': 'GET',
            'headers': headers
        };

        debug("%s %s\n", options.method, options.path);
        debug("----------------------------------------");

        http_call.request(options, (res) => {
            debug("HTTP %s %s\n    %j\n", res.statusCode, res.statusMessage, res.headers);

            if (res.statusCode != 200) {
                let error = new Error(res.statusMessage);
                error.code = res.statusCode;

                pt.emit('error', error);
            } else {
                res.pipe(pt);
            }
        }).on('error', (e) => {
            pt.emit('error', e);
        }).end();

        return pt;
    };

    /**
     * Download file from Content Manager.
     *
     * @param {string} cmpath - Relative path to file on Content Manager
     * @param {string} file - Local filename to store downloaded content in
     * @return {Promise}
     * @api public
     */
    this.download = (cmpath, file) => {
        return new Promise((resolve, reject) => {
            let f = fs.createWriteStream(file).on('error', reject);

            this.downloadStream(cmpath).on('error', (e) => {
                fs.unlink(file);
                reject(e);
            }).pipe(f).on('close', resolve).on('error', (e) => {
                fs.unlink(file);
                reject(e);
            });
        });
    };

    /**
     * Log in to Content Manager (will automatically log out previously logged in user).
     *
     * @param {string} username
     * @param {string} password
     * @return {Promise}
     * @api public
     */
    this.login = (username, password) => {
        let p = Promise.resolve(false);

        this._username = username;
        this._password = password;

        // Log out if already logged in
        if (this._token) {
            debug("LOGOUT");

            this.login_response = {};
            p = this.get('auth/logout', { 'token': this._oldtoken }).then((resp) => {
                this._oldtoken = null;
                this._token = null;
                return resp;
            }).catch((e) => {
                this._oldtoken = null;
                this._token = null;
                return e; // failure is always an option
            });
        }

        return p.then((logout) => {
            if (logout) {
                debug("Logged out...");
            }

            debug("LOGIN %s", username);

            if (this._baseurl.protocol != 'https:' && !(this._baseurl.hostname == 'localhost' || this._baseurl.hostname == '127.0.0.1' || this._baseurl.hostname == '::1')) {
                debug("Warning: Password sent in clear across the network.");
            }

            return this.post('auth/login', { 'username': username, 'password': password }).then((resp) => {
                this.login_response = resp;

                if (this._token_name in resp) {
                    this._token = resp[this._token_name];
                    this._oldtoken = resp.token;

                    debug("token %s is: %s", this._token_name, this._token);
                } else {
                    throw new Error("No token received!");
                }

                return resp;
            });
        });
    };

    /**
     * API GET request.
     *
     * @param {string} endpoint - Endpoint path
     * @param {Object} data - (optional) Parameters
     * @return {Promise}
     * @api public
     */
    this.get = this._request.bind(this, 'GET');

    /**
     * API POST request.
     *
     * @param {string} endpoint - Endpoint path
     * @param {Object} data - (optional) Parameters
     * @return {Promise}
     * @api public
     */
    this.post = this._request.bind(this, 'POST');

    /**
     * API PUT request.
     *
     * @param {string} endpoint - Endpoint path
     * @param {Object} data - (optional) Parameters
     * @return {Promise}
     * @api public
     */
    this.put = this._request.bind(this, 'PUT');

    /**
     * API DELETE request.
     *
     * @param {string} endpoint - Endpoint path
     * @param {Object} data - (optional) Parameters
     * @return {Promise}
     * @api public
     */
    this.delete = this._request.bind(this, 'DELETE');

    this._rooturl = baseurl.endsWith('/') ? baseurl : `${baseurl}/`;
    this._baseurl = url.parse(url.resolve(this._rooturl, 'api/rest/'));
    this._token_name = typeof token_name !== 'undefined' ? token_name : 'apiToken';
    this._token = null;
    this._oldtoken = null;

    /**
     * Cached login response object.
     * @public
     */
    this.login_response = {};
}

exports.ConManager = ConManager;
