import { AsyncStorage, ToastAndroid, Platform } from 'react-native';
import { Toast } from 'native-base';
import { FIREBASE } from "../App";
import { Location } from "./Route";

export const DEBUG = process.env.NODE_ENV == 'development';

/**
 * 
 *  Values stored in the database include: web,user.
 * 
 *      web contains necessary app-specific information.
 *      user contains user-specific information.
 * 
 */
export default class Local {
    WEBAPP_URL = "http://192.168.56.1:8000";
    WEBSOCK_URL = "ws://192.168.56.1:8080";
    AUTH_TOKEN = null;
    static PowerSaver = ['OFF', 'LOW', 'HIGH'];

    REGEX = new RegExp(/^(http|https):\/\/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}|[A-Za-z0-9^\\s]{2,}):[0-9]{1,}.*/i);
    REGEX2 = new RegExp(/^(ws|wss|http|https):\/\/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}|[A-Za-z0-9^\\s]{2,}):[0-9]{1,}.*/i);
    get isSetup() {
        let setup = !this.isLagacy || (this.webAppUrl !== undefined && this.REGEX.test(this.webAppUrl));
        console.log("is setup: ", this.webAppUrl !== undefined, this.REGEX.test(this.webAppUrl), this.webAppUrl);
        return setup;
    }

    get isLagacy() {
        return this.config.USE_LEGACY;
    }

    set useWebSock(use) {
        this.config.USE_WEBSOCK = use;
    }
    get useWebSock() {
        return this.config.USE_WEBSOCK;
    }

    set powerSaver(pS) {
        this.config.POWERSAVER = pS;
    }

    constructor(config) {
        this.config = config;
        this.setWebAppUrl(config.WEBAPP_URL || this.WEBAPP_URL);
        this.setWebSockUrl(config.WEBSOCK_URL || this.WEBSOCK_URL);
        this.fBase = FIREBASE;
    }

    setWebAppUrl(url) {
        if (this.REGEX.test("http://" + url)) {
            this.webAppUrl = 'http://' + url;
        } else if (this.REGEX.test(url)) {
            this.webAppUrl = url;
        } else {
            return false
        }
        this.config.WEBAPP_URL = this.webAppUrl;
        return true;
    }

    setWebSockUrl(url) {
        if (this.REGEX2.test("ws://" + url)) {
            this.webSocketUrl = 'ws://' + url; //TODO: correct this!!!!! -- DONE!!!!!
        } else if (this.REGEX2.test(url)) {
            this.webSocketUrl = url;
        } else {
            return false;
        }
        this.config.WEBSOCK_URL = this.webSocketUrl;
        return true;
    }

    async buildRequest(method, what, data, callback, timeout = 15000, authenticated = false) {
        if (!what) {
            throw Error("No resource argument was provided!")
        }
        let url = this.webAppUrl + what;
        if (data && method === "get") {
            url.concat("data=" + data);
        }
        // TODO: Build subsequest query parts
        console.log("Fetch from " + url);
        // let controller = new AbortController();
        // let signal = controller.signal;
        // signal.onabort = (s, e) => {
        //     consoe.log(s, e);
        //     return callback(null, new Error('Request aborted'));
        // }

        try {
            let response = await this.fetch(url, data, method, timeout, authenticated);
            if (!response) {
                throw new Error('Network request failed');
            }
            let result = await response.json()

            if (!response.ok && response.status > 299) {
                throw new Error(result.error ? result.error.join('. ') : "Error performing your request!");
            }
            if (response.headers.has('X-Auth')) {
                this.AUTH_TOKEN = response.headers.get('X-Auth').trim();
            }
            console.log(result)
            // let result = await response.json()
            if (!result) {
                return callback();
            }
            if (result.error) {
                let err = new Error(result.error.join('. '));
                err.code = result.errno;
                return callback(null, err);
            } else if (result.message.toLowerCase() === 'successful') {
                return callback(result.data);
            }
            // }, err => {
            //     console.log("Resource fetch error", err);

            //     // throw new Error(err);
            //     return callback(null, err);
            // })
        } catch (err) {
            callback(null, err);
        }
    }

    fetch(url, data, method, timeout, authenticated = false) {
        console.log(arguments)
        return new Promise((res, rej) => {
            let headers = new Headers({
                'Content-Type': 'application/json'
            })
            if (authenticated) headers.append('X-Auth', this.AUTH_TOKEN)

            fetch(url, {
                body: data && method !== "get" ? data : null,
                keepalive: true,
                credentials: "include",
                mode: "navigate",
                redirect: "follow",
                method: method || "get",
                // signal: signal,
                headers
            }).then(res).catch(rej);
            if (timeout !== undefined && typeof timeout === 'number') {
                setTimeout((rej), timeout, new Error('Connection timed out!'));
            }
        });
    }

    showVehicles() {

    }

    parseFirebaseUser(res, extra = {}) {
        return new User({ username: res.email.split('@')[0], id: res.id, ...extra });
    }

    getUser(id) {
        fetch()
    }

    addUser(user, callback) {
        if (!this.isLagacy) {
            return new Promise((res, rej) => {
                if (user.password !== user.v_password) {
                    rej(new Error("Passwords do not match!"));
                }
                // this.fBase.auth().onAuthStateChanged(authUser => {
                //     if (this.isLagacy) {
                //         return;
                //     }
                //     console.log("authenticated user is", authUser);
                // });
                return this.fBase.auth().createUserWithEmailAndPassword(user.username + "@local-00000.firebaseapp.com", user.password)
                    .then(auth => {
                        if (auth.user) {
                            return callback(this.parseFirebaseUser(auth.user, { isNewUser: true }));
                        }
                        return callback(null, new Error("Server not responding"));
                    }).catch(rej);
            });
        } else {
            return this.buildRequest("post", "/user/register", JSON.stringify(user), (data, err) => {
                if (err) {
                    throw err;
                }
                if (data) {
                    let user = new User(data.username);
                    user.profile = data.profile;
                    user.token = this.AUTH_TOKEN;
                    if (!DEBUG && this.isLagacy) {
                        this.getWebSocketUrl();
                    }
                    callback(user);
                }
            });
        }
    }

    loginUser(user, callback) {
        if (!this.isLagacy) {
            return new Promise((res, rej) => {
                return this.fBase.auth().signInWithEmailAndPassword(user.username + "@local-00000.firebaseapp.com", user.password)
                    .then((auth) => {
                        if (auth.user) {
                            if (!DEBUG && this.isLagacy) {
                                this.getWebSocketUrl();
                            }
                            return callback(this.parseFirebaseUser(auth.user));
                        }
                        return callback(null, new Error("Server not responding"));
                    }).catch(rej);
            });
        } else {
            return this.buildRequest('post', '/user/login', JSON.stringify(user), (res, err) => {
                if (err) {
                    // throw err;
                    console.log(err)
                    return callback(null, err);
                }
                if (res) {
                    let user = new User(res.username);
                    user.profile = res.profile;
                    user.token = this.AUTH_TOKEN;
                    if (!DEBUG && this.isLagacy) {
                        this.getWebSocketUrl();
                    }
                    return callback(user);
                }
                return callback(null, new Error("Server not responding"));
            }).then(null, error => callback(null, error));
        }
    }

    loginWithToken(token, callback) {
        if (this.isLagacy) {
            return this.buildRequest('post', '/user/login_token', JSON.stringify(token), (res, err) => {
                return callback(this.AUTH_TOKEN, err);
            });
        } else {
            callback();
        }
    }

    addVehicle(username, vehicle, callback) {
        return this.buildRequest('post', '/vehicle/' + username, JSON.stringify({ ...vehicle, user: username }), (res, err) => {
            if (err) {
                return callback(null, err);
            }
            callback(res, err);
        }, 15000, true).catch((err) => {
            callback(null, err)
        });

    }

    deleteVehicle(username, vehicle, callback) {
        return this.buildRequest('delete', '/vehicle/' + username + '/' + vehicle, null, (res, err) => {
            if (err) {
                return callback(null, err);
            }
            callback(res, err);
        }, 15000, true).catch((err) => {
            callback(null, err)
        });

    }
    getVehicles(callback) {
        return this.buildRequest('get', '/vehicle', undefined, (res, err) => {
            if (err) {
                throw err;
            }
            if (res) {
                cars = res.map(val => {
                    let car = new Vehicle(val.id, new Location(parseFloat(val.longitude), parseFloat(val.latitude)));
                    car.brand = val.brand;
                    car.color = val.color;
                    car.model = val.model;
                    car.type = val.type;
                    car.vid = val.vid;
                    car.year = val.year;
                    car.profile = val.profile;
                    car.user = val.user
                    return car;
                })
            }
            // console.log(cars);
            callback(cars, err);
        });
    }

    getVehiclesForUser(username, callback) {
        return this.buildRequest('get', '/vehicle/' + username, undefined, (res, err) => {
            if (err) {
                throw err;
            }
            cars = res.map(val => {
                let car = new Vehicle(val.id, new Location(parseFloat(val.longitude), parseFloat(val.latitude)));
                car.brand = val.brand;
                car.color = val.color;
                car.model = val.model;
                car.type = val.type;
                car.vid = val.vid;
                car.year = val.year;
                car.profile = val.profile;
                return car;
            })
            callback(cars, err)
        });
    }

    getVehicleLocation(vehicleId, callback) {
        if (vehicleId instanceof Array) {
            return this.buildRequest('post', '/location/', JSON.stringify({ 'vehicle': vehicleId }), (res, err) => {
                if (err) {
                    throw err;
                }
                let locationMap = {};
                res.forEach(val => {
                    let location = new Location(val.longitude, val.latitude);
                    location.timestamp = val.timestamp;
                    locationMap[res.vehicle] = location;
                });
                callback(locationMap, err);
            });
        } else {
            return this.buildRequest('get', '/location/' + vehicleId, undefined, (res, err) => {
                if (err) {
                    throw err;
                }
                let val = res[0]; // Since result is for a single vehicle, get that vehicle location
                let location = new Location(val.longitude, val.latitude);
                location.timestamp = val.timestamp;
                callback(location, err);
            });
        }
    }

    setVehicleLocation(vehicle, location, callback) {
        return this.buildRequest('patch', '/vehicle/location/' + vehicle.vid, JSON.stringify({ vehicle: vehicle.vid, longitude: location.longitude, latitude: location.latitude }), (res, err) => {
            if (err) {
                return err;
            }
            callback(res, err);
        });
    }

    logout(callback) {
        if (this.isLagacy) {
            // return this.buildRequest('get', '/user/logout', null, res => {
            this.AUTH_TOKEN = null;
            return callback();
            // });
        } else {
            return this.fBase.auth().signOut().then(callback);
        }
    }

    reset() {
        this.AUTH_TOKEN = null
        return new User
    }

    getWebSocketUrl(cb) {
        let result = false;
        try {
            fetch(this.webAppUrl + '/config/websock', {
                keepalive: true,
                credentials: "include",
                mode: "navigate",
                redirect: "follow",
                method: "GET",
            })
                .then(response => { console.log(response); return response.json() })
                .then(json => {
                    console.log(json);
                    if (json.error) {
                        throw new Error(json.error);
                    }
                    if (json && json.data.url) {
                        Local.toast('WebSocket url is: ' + json.data.url, { type: 'success' })
                        result = json.data.url;
                        cb(result);
                    }
                }).catch(err => {
                    Local.toast(err.message, { type: 'danger' });
                    cb(null, err);
                });
        } catch (err) {
            Toast.show(err.message, { type: 'danger' });
            cb(null, err);
        };
    }

    static toast(message, options = {}) {
        option = { type: 'info', duration: ToastAndroid.SHORT, position: 'center', ...options }
        if (Platform.OS === "android") {
            let position;
            switch (options.position || 'center') {
                case 'bottom':
                    position = ToastAndroid.BOTTOM;
                    break;
                case 'center':
                    position = ToastAndroid.CENTER;
                    break;
                case 'top':
                    position = ToastAndroid.TOP;
                    break;
            }

            ToastAndroid.showWithGravity(message, options.duration || ToastAndroid.SHORT, position);
        } else {
            Toast.show({ text: message, type: options.type || 'info', position: options.position || 'center' });
        }
    }
}


export function debounce(func, duration = 250, immediate = false) {
    let timeout;
    return function () {
        let context = this, args = arguments;
        let later = function () {
            console.log(context);
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        let callnow = immediate && !timeout
        clearTimeout(timeout);
        timeout = setTimeout(later, duration);
        if (callnow) func.apply(context, args);
    }
}

export class Vehicle {
    model = null
    brand = null
    year = 0
    vid = null
    color = null
    type = null
    profile = null

    constructor(id, location) {
        this.id = id
        this.location = location
    }
}

export class User {
    isactive = false;
    username = null
    location = null
    id = -1
    vehicles = []
    profile = null
    token = null;
    isNewUser = false;
    get profileSrc() {
        return "data:image/png;base64," + this.profile;
    }

    constructor(username) {
        if (username && typeof username === 'object') {
            this.username = username.username;
            this.location = username.location;
            this.id = username.id;
            this.vehicles = username.vehicles;
            this.profile = username.profile;
            this.token = username.token;
        } else {
            this.username = username
        }
    }

    login(user) {
        this.username = user.username;
        this.profile = user.profile;
        this.location = user.location;
        this.useFingerprint = user.useFingerprint;
        this.vehicles = null;
        this.token = user.token;
        this.id = user.id;
    }

    save(token) {
        if (token) {
            this.token = token;
        }
        AsyncStorage.setItem('user', JSON.stringify(this), err => {
            if (err) {
                console.log(err)
            }
        });
    }

}

export function SET_VEHICLE_LOCATION(vehicle, location) { }