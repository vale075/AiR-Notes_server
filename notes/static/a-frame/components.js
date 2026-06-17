AFRAME.registerComponent('my-note', {
    schema: {
        text: { type: 'string', default: 'Hello' },
        color: { type: 'color', default: '#1a1a2e' }
    },

    init: function () {
        // runs once when the component is attached to an entity
        const el = this.el;
        const data = this.data;

        // create a panel plane as a child
        const panel = document.createElement('a-plane');
        panel.setAttribute('width', '1.5');
        panel.setAttribute('height', '0.8');
        panel.setAttribute('color', data.color);

        const text = document.createElement('a-text');
        text.setAttribute('value', data.text);
        text.setAttribute('align', 'center');
        text.setAttribute('color', 'white');
        text.setAttribute('width', '1.4');

        el.appendChild(panel);
        el.appendChild(text);
    },

    update: function () {
        // runs when schema properties change at runtime
    },

    tick: function () {
        // runs every frame — keep it light
    },

    remove: function () {
        // cleanup when component is removed
    }
});