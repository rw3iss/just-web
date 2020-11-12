function Router(options) {
    if (!(this instanceof Router)) return new Router(options);

    this._init(options);
}

Router.prototype._init = function (options) {
    options = options || {}

    this.child = Object.create(null)
    this.children = []
    this.name = options.name || ''

    if (typeof options.string === 'string')
        this.string = options.string
    else if (typeof options.regex === 'string')
        this.regex = new RegExp(
            '^(' + options.regex + ')$',
            options.flag == null ? 'i' : options.flag
        )
    else if (options.regex instanceof RegExp)
        this.regex = options.regex
}

// Find || (create && attach) a child node
Router.prototype._add = function (options) {
    return this._find(options)
        || this._attach(options)
}

// Find a child node based on a bunch of options
Router.prototype._find = function (options) {
    // Find by string
    if (typeof options.string === 'string') return this.child[options.string]

    var child
    var children = this.children
    var l = children.length

    // Find by name
    if (options.name)
        for (var j = 0; j < l; j++)
            if ((child = children[j]).name === options.name)
                return child
}

// Attach a node to this node
Router.prototype._attach = function (node) {
    if (!(node instanceof Router)) node = new Router(node)

    node.parent = this

    if (node.string == null) this.children.push(node)
    else this.child[node.string] = node

    return node
}

module.exports = Router;