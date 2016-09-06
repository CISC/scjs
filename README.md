# scjs - A simple interface to Scala Content Manager web-services.

This module is loosely modelled after the scws2 Python module, supporting the 2.x REST API.

## Example usage (set DEBUG=scjs for debug output):

```js
scjs = require('scjs');

var baseurl = "http://localhost/ContentManager";
var username = "user";
var password = "pass";
var cm = new scjs.ConManager(baseurl);
cm.login(username, password).then((resp) => {
    cm.get('players', { 'limit': 0, 'offset': 0, 'fields': 'id,name,enabled,active,type' }).then((players) => {
        console.log(players.list);
    });
    cm.get('media', { 'limit': 10, 'filters': '{"type":{"values":["IMAGE"]}}' }).then((media) => {
        var p = Promise.resolve();
        media.list.forEach((item) => {
            p = p.then(cm.download(item.downloadPath, item.name));
        });
    });
    cm.upload('LocalFolder/MyPicture.jpg', 'RemoteFolder/MyPicture.jpg').then((item) => {
        console.log(item);
    });
}).catch((e) => {
    console.log(e);
});
```
