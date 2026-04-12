#!/bin/bash

# Hilbert CLI completion for Bash
# Source this file: source completions/hilbert.bash

_hilbert_completions() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    opts="interactive research sessions setup doctor config replicate audit jobs"
    opts="$opts --rounds --model --output --sub-questions --top-k --confidence --show"

    if [[ ${cur} == -* ]] ; then
        COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
        return 0
    fi

    case ${prev} in
        hilbert)
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
            ;;
        research|replicate|audit)
            COMPREPLY=()
            ;;
        config)
            COMPREPLY=( $(compgen -W "--model --output --show" -- ${cur}) )
            ;;
        *)
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
            ;;
    esac
    
    return 0
}

complete -F _hilbert_completions hilbert
complete -F _hilbert_completions node/dist/index.js