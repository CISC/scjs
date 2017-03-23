'use strict';

const scjs = require('../');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpfile = "_scjs_test_file_.tst";
const tmpsize = 10000002;

describe("API", function () {
    let conn;
    let cm;
    let tmp;
    let plrids;
    let upitem1, upitem2;

    before(function (done) {
        fs.readFile('./test/connection.json', 'utf8', (err, data) => {
            if (err) return done(err);
            conn = JSON.parse(data);
            cm = new scjs.ConManager(conn.baseurl);

            fs.mkdtemp(path.join(os.tmpdir(), 'scjs-'), (err, folder) => {
                if (err) return done(err);
                fs.open(path.join(folder, tmpfile), 'w+', (err, fd) => {
                    if (err) return done(err);
                    fs.ftruncate(fd, tmpsize, (err) => {
                        if (err) return done(err);
                        fs.write(fd, 'start', 0, (err) => {
                            if (err) return done(err);
                            fs.write(fd, 'middle', tmpsize/2, (err) => {
                                if (err) return done(err);
                                fs.write(fd, 'end', tmpsize-3, (err) => {
                                    if (err) return done(err);
                                    fs.close(fd, () => {
                                        tmp = folder;
                                        return done();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    after(function (done) {
        if (tmp) {
            let files = fs.readdirSync(tmp);
            files.forEach((file) => {
                fs.unlinkSync(path.join(tmp, file));
            });
            fs.rmdirSync(tmp);
        }
        return done();
    });

    describe("login()", function () {
        it('should return token', function () {
            return cm.login(conn.username, conn.password).then((resp) => {
                assert.deepStrictEqual(resp, cm.login_response);
                assert.ok(cm._token);
            });
        });
    });

    describe("get('players')", function () {
        it('should get a list of Players', function () {
            return cm.get('players').then((players) => {
                assert.ok(players.list);
                plrids = players.list.map(player => player.id);
                return Promise.resolve(plrids);
            });
        });
    });

    describe("post('storage')", function () {
        it('should get heartbeat of Players', function () {
            return cm.post('storage', { 'ids': plrids }).then((uuid) => {
                return cm.get(`players/${uuid.value}/states`).then((states) => {
                    assert.ok(states.states.every(x => plrids.indexOf(x.id) !== -1));
                });
            });
        });
    });

    describe("upload(file)", function () {
        it('should upload testfile', function () {
            this.timeout(0);
            return cm.upload(path.join(tmp, tmpfile)).then((item) => {
                assert.ok(item.mediaId);
                upitem1 = item;
                return Promise.resolve(upitem1);
            });
        });
    });

    describe("put('media/{file.mediaId}')", function () {
        it('should add a description', function () {
            return cm.put(`media/${upitem1.mediaId}`, { 'id': upitem1.mediaId, 'description': 'Test' });
        });
    });

    describe("get('media/{file.mediaId}', {'fields': 'id,description,length,downloadPath'})", function () {
        before(function () {
            return cm.get(`media/${upitem1.mediaId}`, { 'fields': 'id,description,length,downloadPath' }).then((item) => {
                upitem1 = item;
                return Promise.resolve(upitem1);
            });
        });

        it('should be same size as original file', function (done) {
            assert.strictEqual(upitem1.length, tmpsize);
            return done();
        });
        it('should have the description "Test"', function (done) {
            assert.strictEqual(upitem1.description, 'Test');
            return done();
        });
        it('should not have the name field', function (done) {
            assert.strictEqual(upitem1.name, undefined);
            return done();
        });
    });

    describe("uploadStream(downloadStream(media.downloadPath))", function () {
        it('should pipe testfile', function () {
            this.timeout(0);
            return cm.uploadStream(cm.downloadStream(upitem1.downloadPath), `_new${tmpfile}`).then((item) => {
                assert.ok(item.mediaId);
                upitem2 = item;
                return Promise.resolve(upitem2);
            });
        });
    });

    describe("download(media.downloadPath)", function () {
        let buf = Buffer.allocUnsafe(8);

        before(function () {
            return cm.get(`media/${upitem2.mediaId}`).then((item) => {
                upitem2 = item;
                return Promise.resolve(upitem2);
            });
        });

        it('should download testfile', function () {
            this.timeout(0);
            return cm.download(upitem2.downloadPath, path.join(tmp, `_new${tmpfile}`));
        });
        it('should be same size as original file', function (done) {
            fs.stat(path.join(tmp, `_new${tmpfile}`), (err, stats) => {
                if (err) return done(err);
                assert.strictEqual(stats.size, tmpsize);
                return done();
            });
        });
        it('should have "start" at the beginning', function (done) {
            fs.open(path.join(tmp, `_new${tmpfile}`), 'r', (err, fd) => {
                if (err) return done(err);
                fs.read(fd, buf, 0, 5, 0, (err, bytesRead, buffer) => {
                    if (err) return done(err);
                    assert.strictEqual(buffer.toString('utf8', 0, 5), 'start');
                    fs.close(fd, () => {
                        return done();
                    });
                });
            });
        });
        it('should have "middle" at the middle', function (done) {
            fs.open(path.join(tmp, `_new${tmpfile}`), 'r', (err, fd) => {
                if (err) return done(err);
                fs.read(fd, buf, 0, 6, tmpsize/2, (err, bytesRead, buffer) => {
                    if (err) return done(err);
                    assert.strictEqual(buffer.toString('utf8', 0, 6), 'middle');
                    fs.close(fd, () => {
                        return done();
                    });
                });
            });
        });
        it('should have "end" at the end', function (done) {
            fs.open(path.join(tmp, `_new${tmpfile}`), 'r', (err, fd) => {
                if (err) return done(err);
                fs.read(fd, buf, 0, 3, tmpsize-3, (err, bytesRead, buffer) => {
                    if (err) return done(err);
                    assert.strictEqual(buffer.toString('utf8', 0, 3), 'end');
                    fs.close(fd, () => {
                        return done();
                    });
                });
            });
        });
    });

    describe("delete('media/{media.id}')", function () {
        it('should delete testfiles', function () {
            return Promise.all([
                cm.delete(`media/${upitem1.id}`),
                cm.delete(`media/${upitem2.id}`)
            ]);
        });
    });

    describe("login(baduser, badpass)", function () {
        it('should fail', function () {
            return cm.login('', '').then((resp) => {
                assert.ok(!cm._token);
                throw new Error(resp);
            }).catch((err) => {
                assert.ok(!cm._token);
            });
        });
    });
});