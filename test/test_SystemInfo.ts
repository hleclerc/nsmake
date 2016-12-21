/// <reference path="../node_modules/@types/mocha/index.d.ts"/>
import { SystemInfo, is_compatible_with } from '../src/SystemInfo';

describe( 'Vlq', () => {
    it( 'should undestand system requirements', () => {
        const sys = { os: "linux", dist: "Ubuntu Linux", codename: "Shmurtz", release: 12.04, } as SystemInfo;
        console.assert( is_compatible_with( sys, [ "linux" ] ) );
        console.assert( ! is_compatible_with( sys, [ "windows" ] ) );
        console.assert( is_compatible_with( sys, [ "Ubuntu Linux" ] ) );
        console.assert( is_compatible_with( sys, [ "Ubuntu Linux < 16.04" ] ) );
        console.assert( is_compatible_with( sys, [ "Ubuntu Linux >= 10.04" ] ) );
        console.assert( ! is_compatible_with( sys, [ "Ubuntu Linux < 13.10 > 16.04" ] ) );
    });
});
