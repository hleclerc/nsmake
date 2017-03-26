#pragma once

#include <string>

namespace Path {

inline std::string dirname( std::string filename ) {
    auto index = filename.rfind( '/' );
    return index != std::string::npos ? filename.substr( 0, index ) : "";
}

inline std::string resolve( std::string a, std::string b ) {
    if ( b.empty() )
        return a;
    if ( b[ 0 ] == '/' )
        return b;
    if ( a.empty() )
        return b;
    if ( a.back() != '/' )
        a += '/';
    return a + b;
}

}
