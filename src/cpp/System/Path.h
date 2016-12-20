#pragma once

#include <string>

namespace Path {

inline std::string dirname( std::string filename ) {
    auto index = filename.rfind( '/' );
    return index != std::string::npos ? filename.substr( 0, index ) : "";
}

}
