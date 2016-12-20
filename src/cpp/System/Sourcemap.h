#ifndef SOURCEMAP_H
#define SOURCEMAP_H

#include <string>
#include <vector>

///
class Sourcemap {
public:
    struct Entry {
        unsigned gl;
        unsigned gc;
        unsigned ol;
        unsigned oc;
        unsigned of;
    };

    Sourcemap();

    void                     add_entry      ( const std::string &filename, const char *&lwe, unsigned &cl, unsigned &cc, const char *pos, bool reg = true );
    void                     write_to_stream( const std::string &filename, std::ostream &os ) const; ///< javascript sourcemap format
    unsigned                 filenum        ( const std::string &filename );
    std::string              str            ( const std::string &filename );


    std::vector<std::string> ori_files;
    std::vector<Entry>       entries;
    unsigned                 gl;       ///< current gen line
    unsigned                 gc;       ///< current gen col
};

#endif // SOURCEMAP_H
