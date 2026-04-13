# Hilbert CLI completion for Zsh
# Place in ~/.zsh/completions/ or source this file

_hilbert() {
    local -a commands
    commands=(
        'interactive:Start interactive REPL mode'
        'research:Run a research workflow'
        'sessions:Manage research sessions'
        'setup:First-time setup and configuration'
        'doctor:Check installation and configuration'
        'config:Manage configuration'
        'replicate:Plan and execute paper replication'
        'audit:Audit paper claims against code'
        'jobs:List background jobs'
    )

    local -a options
    options=(
        '-r[Number of research rounds]'
        '--rounds[Number of research rounds]'
        '-m[LLM model to use]'
        '--model[LLM model to use]'
        '-o[Output directory]'
        '--output[Output directory]'
        '-s[Number of parallel sub-questions]'
        '--sub-questions[Number of parallel sub-questions]'
        '-k[ Papers to retain after merger]'
        '--top-k[Papers to retain after merger]'
        '-c[Minimum confidence threshold]'
        '--confidence[Minimum confidence threshold]'
    )

    _describe 'command' commands
    _describe 'option' options
}

compdef _hilbert hilbert
compdef _hilbert node_dist_index.js