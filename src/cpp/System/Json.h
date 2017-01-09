#pragma once

#include "json/json.h"
#include "Print.h"

/// auto conversion of a Json => cpp value
struct FromJson from_json( const Json::Value &val );

//
struct FromJson {
    FromJson( const Json::Value &val ) : val( val ) {
    }
    operator std::string() const {
        return val.asString();
    }
    operator bool() const {
        return val.asBool();
    }
    operator int() const {
        return val.asInt();
    }
    operator unsigned() const {
        return val.asUInt();
    }
    template<class T>
    operator std::vector<T>() const {
        std::vector<T> res;
        for( const Json::Value &ch : val )
            res.emplace_back( from_json( ch ) );
        return res;
    }
    const Json::Value &val;
};

inline FromJson from_json( const Json::Value &val ) {
    return val;
}

template<class T>
Json::Value to_json( const T &val ) {
    return { val };
}

template<class T>
inline Json::Value to_json( const std::vector<T> &vec ) {
    Json::Value res( Json::arrayValue );
    for( const T &val : vec )
        res.append( to_json( val ) );
    return res;
}

//
inline Json::Value json_parse( std::string v ) {
    Json::Value res;
    Json::Reader reader;
    reader.parse( v, res );
    return res;
}

//
inline std::string json_stringify( const Json::Value &v, bool add_lf = false ) {
    Json::FastWriter writer;
    if ( ! add_lf )
        writer.omitEndingLineFeed();
    return writer.write( v );
}
