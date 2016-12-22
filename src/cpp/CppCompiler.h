#pragma once

#include "Task.h"

/**
 */
class CppCompiler : public Task {
public:
    CppCompiler( const Json::Value &root );
    void exec();
};
