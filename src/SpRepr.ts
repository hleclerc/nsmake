require('source-map-support').install();

/** Enable to replace back and forth '\n' and ' '
 * Typical application: send a message ended by a '\n', with arguments separated by ' ' 
 */
export default
class SpRepr {
    static encode( str : string ) : string {
        let res = "";
        for( let c of str ) {
            switch( c ) {
                case '\\': res += '\\\\'; break;
                case '\n': res += '\\n' ; break;
                case ' ' : res += '\\s' ; break;
                default  : res += c;
            }
        }
        return res;
    }
    static decode( str : string ) : string {
        let res = "";
        for( let i = 0; i < str.length; ++i ) {
            if ( str[ i ] == '\\' && i + 1 < str.length ) {
                switch( str[ i + 1 ] ) {
                    case '\\': res += '\\'; ++i; break;
                    case 'n' : res += '\n'; ++i; break;
                    case 's' : res += ' ' ; ++i; break;
                }
            } else
                res += str[ i ];
        }
        return res;
    }
}
