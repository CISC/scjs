# scjs - A simple interface to Scala Content Manager web-services.

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![GitHub Issues][issues-image]][issues-url]
[![GitHub Pull Requests][pulls-image]][pulls-url]
[![Inline docs][docs-image]][docs-url]
[![Known Vulnerabilities][vulns-image]][vulns-url]

This module is loosely modelled after the scws2 Python module, supporting the 2.x REST API.

## Example usage (set DEBUG=scjs for debug output):

```js
const { ConManager } = require('scjs');

const baseurl = "http://localhost/ContentManager";
const username = "user";
const password = "pass";
const cm = new ConManager(baseurl);

(async () => {
    const resp = await cm.login(username, password);

    try {
        const players = await cm.get('players', { 'limit': 0, 'offset': 0, 'fields': 'id,name,enabled,active,type' });
        console.log(players.list);

        const media = await cm.get('media', { 'limit': 10, 'filters': '{"type":{"values":["IMAGE"]}}' });

        let items = [];
        for (const item of media.list) {
            items.push(cm.download(item.downloadPath, item.name));
        }
        await Promise.all(items);

        const item = await cm.upload('LocalFolder/MyPicture.jpg', 'RemoteFolder/MyPicture.jpg');
        console.log(item);
    } finally {
        await cm.post('auth/logout');
    }
})().catch((e) => {
    console.log(e);
});
```

[npm-image]: https://img.shields.io/npm/v/scjs.svg
[npm-url]: https://npmjs.org/package/scjs
[downloads-image]: https://img.shields.io/npm/dt/scjs.svg
[downloads-url]: https://npmjs.org/package/scjs
[issues-image]: https://img.shields.io/github/issues/cisc/scjs.svg
[issues-url]: https://github.com/cisc/scjs/issues
[pulls-image]: https://img.shields.io/github/issues-pr/cisc/scjs.svg
[pulls-url]: https://github.com/cisc/scjs/pulls
[docs-image]: http://inch-ci.org/github/cisc/scjs.svg?branch=master&style=shields
[docs-url]: http://inch-ci.org/github/cisc/scjs
[vulns-image]: https://snyk.io/test/npm/scjs/badge.svg
[vulns-url]: https://snyk.io/test/npm/scjs
