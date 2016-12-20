#ifndef NSMDEFINE_H
#define NSMDEFINE_H

#include <vector>
#include <map>

struct Define {
    Define( std::string &&content = {}, std::vector<std::string> &&variables = {}, bool need_p = false ) : variables( std::move( variables ) ), content( std::move( content ) ), need_p( need_p or this->variables.size() ) {
    }

    std::vector<std::string> variables;
    std::string              content;
    bool                     need_p;
};

#endif // NSMDEFINE_H
