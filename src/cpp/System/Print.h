#pragma once

#include <iostream>
#include <iomanip>
#include <sstream>
#include <string>

namespace NSMake {

/// classes with `write_to_stream` will be displayed by default with the corresponding methods
template<class T>
auto operator<<( std::ostream &os, const T &val ) -> decltype( val.write_to_stream( os ), os ) {
    val.write_to_stream( os );
    return os;
}

/// classes with `begin` will be displayed by default with the corresponding method
template<class T>
auto operator<<( std::ostream &os, const T &val ) -> decltype( val.begin(), os ) {
    int cpt = 0;
    os << "[";
    for( const auto &v : val )
        os << ( cpt++ ? "," : "" ) << v;
    os << "]";
    return os;
}

template<class T0,class T1>
std::ostream &operator<<( std::ostream &os, const std::pair<T0,T1> &val ) {
    return os << val.first << ":" << val.second;
}

inline
std::ostream &operator<<( std::ostream &os, const std::string &val ) {
    return os.write( val.data(), val.size() );
}

template<class OS,class T0> void __my_print( OS &os, const T0 &t0 ) { os << t0 << std::endl; }
template<class OS,class T0,class... Args> void __my_print( OS &os, const T0 &t0, const Args &...args ) { os << t0 << ", "; __my_print( os, args... ); }

#ifndef P
    #define P( ... ) \
        NSMake::__my_print( std::cerr << #__VA_ARGS__ " -> ", __VA_ARGS__ );
    #define PO( OS, ... ) \
        NSMake::__my_print( OS << #__VA_ARGS__ " -> ", __VA_ARGS__ );
    #define PM( MSG, ... ) \
        NSMake::__my_print( std::cerr << MSG << #__VA_ARGS__ " -> ", __VA_ARGS__ );
    #define PE( ... ) \
        NSMake::__my_print( std::cerr << #__VA_ARGS__ " -> ", __VA_ARGS__ );
    #define PN( ... ) \
        NSMake::__my_print( std::cerr << #__VA_ARGS__ " ->\n", __VA_ARGS__ );
    #define PL( ... ) \
        NSMake::__my_print( std::cerr << __FILE__ << ":" << __LINE__ << ": " << #__VA_ARGS__ " -> ", __VA_ARGS__ );
    #define PF( ... ) \
        NSMake::__my_print( std::cerr << __PRETTY_FUNCTION__ << ": " << #__VA_ARGS__ " -> ", __VA_ARGS__ );
#endif

template<class T>
std::string to_string( const T &val ) {
    std::ostringstream ss;
    ss << val;
    return ss.str();
}

template<class T>
std::string to_string_hex( const T &val ) {
    std::ostringstream ss;
    ss << std::hex << val;
    return ss.str();
}

template<class T>
struct PointedValues {
    void write_to_stream( std::ostream &os ) const {
        int cpt = 0;
        for( const auto &v : val )
            os << ( cpt++ ? sep : "" ) << *v;
    }
    T           val;
    std::string sep;
};

template<class T>
PointedValues<T> pointed_values( const T &val, const std::string &sep = "," ) {
    return { val, sep };
}

template<class T,class F>
struct MappedValues {
    void write_to_stream( std::ostream &os ) const {
        int cpt = 0;
        for( const auto &v : val )
            os << ( cpt++ ? "," : "" ) << fun( v );
    }
    T val;
    F fun;
};

template<class T,class F>
MappedValues<T,F> mapped_values( const T &val, const F &fun ) {
    return { val, fun };
}

template<class T>
struct Values {
    void write_to_stream( std::ostream &os ) const {
        int cpt = 0;
        for( const auto &v : val )
            os << ( cpt++ ? "," : "" ) << v;
    }
    const T &val;
};

template<class T>
Values<T> values( const T &val ) {
    return { val };
}

/** prepend pre to lines of str */
inline std::string preprend_lines( const std::string &str, const std::string &pre ) {
    std::string res;
    res.reserve( str.size() + pre.size() );
    res = pre;
    for( char c : str ) {
        if ( c == '\n' )
            res += '\n' + pre;
        else
            res += c;
    }
    return res;
}

} // namespace NSMake

