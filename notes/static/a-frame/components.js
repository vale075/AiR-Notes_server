class NoteService {
    constructor(baseUrl = '/api/notes') {
        this.baseUrl = baseUrl;
    }

    // Helper to retrieve the standard Django CSRF token from cookies
    _getCsrfToken() {
        const name = 'csrftoken';
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return '';
    }

    // Standard request headers for Session Auth + JSON payloads
    _getHeaders(isMultipart = false) {
        const headers = {
            'X-CSRFToken': this._getCsrfToken(),
        };
        if (!isMultipart) {
            headers['Content-Type'] = 'application/json';
        }
        return headers;
    }

    /**
     * Fetch all notes assigned to a specific QR Code UUID
     * Maps to: GET /api/notes/qrcode/{qr_id}/notes
     */
    async getNotesForQRCode(qrId) {
        try {
            const response = await fetch(`${this.baseUrl}/qrcode/${qrId}/notes`);
            if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
            return await response.json(); // Returns an array of notes
        } catch (error) {
            console.error(`Error fetching notes for QR ${qrId}:`, error);
            throw error;
        }
    }

    /**
     * Create a Text Note
     * Maps to: POST /api/notes/notes/text
     * payload format: { qrcode_id, content, title, pos_x, pos_y, pos_z, ... }
     */
    async createTextNote(payload) {
        try {
            const response = await fetch(`${this.baseUrl}/notes/text`, {
                method: 'POST',
                headers: this._getHeaders(),
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`Failed to create text note: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("Error creating text note:", error);
            throw error;
        }
    }

    /**
     * Update an existing Text Note
     * Maps to: PUT /api/notes/notes/text/{note_id}
     */
    async updateTextNote(noteId, payload) {
        try {
            const response = await fetch(`${this.baseUrl}/notes/text/${noteId}`, {
                method: 'PUT',
                headers: this._getHeaders(),
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`Failed to update text note: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`Error updating text note ${noteId}:`, error);
            throw error;
        }
    }

    /**
     * Create an Image Note (Uses Multipart/Form-Data)
     * Maps to: POST /api/notes/notes/image
     * Expects a native File object and the metadata payload object
     */
    async createImageNote(file, payload) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('payload', JSON.stringify(payload));

            const response = await fetch(`${this.baseUrl}/notes/image`, {
                method: 'POST',
                headers: this._getHeaders(true), // omit Content-Type so browser sets boundary
                body: formData
            });
            if (!response.ok) throw new Error(`Failed to create image note: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("Error creating image note:", error);
            throw error;
        }
    }

    /**
     * Create an Arrow Note
     * Maps to: POST /api/notes/notes/arrow
     * payload format: { qrcode_id, content, title, pos_x, pos_y, pos_z, ... }
     */
    async createArrowtNote(payload) {
        try {
            const response = await fetch(`${this.baseUrl}/notes/arrow`, {
                method: 'POST',
                headers: this._getHeaders(),
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`Failed to create arrow note: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("Error creating arrow note:", error);
            throw error;
        }
    }

    /**
     * Update an existing Arrow Note
     * Maps to: PUT /api/notes/notes/Arrow/{note_id}
     */
    async updateArrowNote(noteId, payload) {
        try {
            const response = await fetch(`${this.baseUrl}/notes/arrow/${noteId}`, {
                method: 'PUT',
                headers: this._getHeaders(),
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`Failed to update arrow note: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`Error updating arrow note ${noteId}:`, error);
            throw error;
        }
    }

    /**
     * Delete any note by ID
     * Maps to: DELETE /api/notes/notes/{note_id}
     */
    async deleteNote(noteId) {
        try {
            const response = await fetch(`${this.baseUrl}/notes/${noteId}`, {
                method: 'DELETE',
                headers: this._getHeaders()
            });
            if (!response.ok) throw new Error(`Failed to delete note: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`Error deleting note ${noteId}:`, error);
            throw error;
        }
    }
}

// Global instantiation
const noteService = new NoteService();

AFRAME.registerComponent('qr-space-controller', {
    schema: {
        qrid: { type: 'string' }
    },

    init: function () {
        this.currentQrId = this.data.qrid;

        const validateBtnEl = document.querySelector("#uiBtn");
        const uiTxtEl = document.querySelector("#uiTxt");
        const coordinatesMarkerEl = document.querySelector("#coordinatesMarker");
        const qrUiEl = document.querySelector("#qrUi");
        this.notesEl = document.querySelector("#notes");

        const surfaceNormal = new THREE.Vector3();
        const cameraPosition = new THREE.Vector3();
        const rotationMatrix = new THREE.Matrix4();
        const xAxis = new THREE.Vector3();
        const yAxis = new THREE.Vector3();

        this.positionQRcode = (event) => {
            if (!this.elToMove) {
                return;
            }
            const { position, orientation } = event.detail;

            // 1. Position
            const hitPos = new THREE.Vector3();
            this.elToMove.object3D.position.set(position.x, position.y, position.z);
            coordinatesMarkerEl.object3D.position.set(position.x, position.y, position.z);

            // 2. Surface normal — derived correctly from the hit pose's quaternion.
            // Per the WebXR hit-test spec, the Y axis of that quaternion's local frame
            // is defined to align with the surface normal; orientation.x/y/z alone is
            // not a usable direction.
            const hitQuaternion = new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w);
            surfaceNormal.set(0, 1, 0).applyQuaternion(hitQuaternion).normalize();

            // 3. Camera world position
            const cameraEl = this.el.sceneEl.camera;
            cameraEl.getWorldPosition(cameraPosition);

            let tempUp = new THREE.Vector3(0, 1, 0);

            if (Math.abs(surfaceNormal.y) > 0.9) {
                // Floor/ceiling: derive "up" from camera POSITION relative to the hit
                // point, not camera orientation — the hit-test ray can land off-center
                // from where the camera is actually pointed.
                const hitPosition = new THREE.Vector3(position.x, position.y, position.z);
                const awayFromCamera = hitPosition.clone().sub(cameraPosition);
                awayFromCamera.projectOnPlane(surfaceNormal);

                // Degenerate case: tapping almost directly below the camera leaves a
                // near-zero horizontal component — normalizing that gives NaN. Fall
                // back to a fixed world direction instead.
                if (awayFromCamera.lengthSq() < 1e-6) {
                    awayFromCamera.set(0, 0, -1).projectOnPlane(surfaceNormal);
                }
                tempUp.copy(awayFromCamera.normalize());
            }

            // 4-7. Build the orthonormal basis — unchanged, this part was already correct
            xAxis.crossVectors(tempUp, surfaceNormal).normalize();
            yAxis.crossVectors(surfaceNormal, xAxis).normalize();
            rotationMatrix.makeBasis(xAxis, yAxis, surfaceNormal);

            this.elToMove.object3D.quaternion.setFromRotationMatrix(rotationMatrix);
            coordinatesMarkerEl.object3D.quaternion.setFromRotationMatrix(rotationMatrix);
            if (this.elToMove != this.el) {
                var worldToLocal = new THREE.Matrix4().copy(this.el.object3D.matrixWorld).invert();
                this.elToMove.object3D.applyMatrix4(worldToLocal);
            }

            this.elToMove.object3D.visible = true;
            coordinatesMarkerEl.object3D.visible = true;
            validateBtnEl.object3D.visible = true;
        };

        this.elToMove = this.el;
        this.el.sceneEl.addEventListener("ar-hit-test-select", this.positionQRcode);

        validateBtnEl.addEventListener("click", (event) => {
            this.elToMove = false;
            validateBtnEl.object3D.visible = false;
            uiTxtEl.object3D.visible = false;
            coordinatesMarkerEl.object3D.visible = false;
            qrUiEl.object3D.visible = true;
            this.notesEl.object3D.visible = true;
        }, { once: true });

        const closeNoteBtnEl = document.querySelector("#closeNoteBtn");

        closeNoteBtnEl.addEventListener("click", (event) => {
            location.reload();
        })

        const newTxtNoteBtnEL = document.querySelector("#newTxtNoteBtn");

        newTxtNoteBtnEL.addEventListener("click", (event) => {
            const el = document.createElement('a-entity');
            el.setAttribute('visible', false);
            el.setAttribute('txtnote', { qrcode_id: this.currentQrId, temporary: true });
            this.notesEl.appendChild(el);

            validateBtnEl.addEventListener("click", (event) => {
                this.elToMove = false;
                uiTxtEl.object3D.visible = false;
                validateBtnEl.object3D.visible = false;
                coordinatesMarkerEl.object3D.visible = false;
                newTxtNoteBtnEL.emit('mouseleave', {}, false);
                el.setAttribute('txtnote', 'temporary', false);
            }, { once: true });

            uiTxtEl.setAttribute('value', "Cliquez sur l'emplacement voulu");

            this.elToMove = el;

            uiTxtEl.object3D.visible = true;
        })

        if (!this.currentQrId) {
            console.error("No QRCode id was passed !");
            throw error;
        }
        else {
            this.loadSceneNotes();
        }
    },

    // Automatically fetches and maps notes into 3D Space
    loadSceneNotes: async function () {
        try {
            const notes = await noteService.getNotesForQRCode(this.currentQrId);
            for (const note of notes) {
                delete note.updated_at;
                delete note.created_at;
                const note_type = note.note_type;
                delete note.note_type;
                switch (note_type) {
                    case 'TXT': {
                        const el = document.createElement('a-entity');
                        el.setAttribute('txtnote', note);
                        this.notesEl.appendChild(el);
                        break;
                    }
                    case 'IMA': {
                        const el = document.createElement('a-image');
                        el.setAttribute('imgnote', note);
                        this.notesEl.appendChild(el);
                        break;
                    }
                    case 'ARR': {
                        const el = document.createElement('a-entity');
                        el.setAttribute('arrnote', note);
                        this.notesEl.appendChild(el);
                        break;
                    }
                    default:
                        console.error("Undefined note type: ", note.note_type);
                        break;
                }
            }
        } catch (err) {
            console.error("Could not load nodes into A-Frame space", err);
        }
    }
});


const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
const whisperServerUrl = `${wsScheme}://${window.location.host}/ws/whisper/`;

// ─────────────────────────────────────────────────────────────────────────────
// WhisperLive dictation singleton
//
// Owns ONE AudioContext + WorkletNode shared across all txtnote instances.
// Only one note can dictate at a time; starting a new one stops the previous.
// ─────────────────────────────────────────────────────────────────────────────
const WhisperDictation = (() => {
    // AudioWorklet processor: buffers mic input into 4096-sample float32 chunks
    // and posts { pcm: ArrayBuffer, rms: number } back to the main thread.
    const WORKLET_SRC = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() { super(); this._buf = []; this._bufLen = 0; this._chunkSize = 4096; }
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    this._buf.push(new Float32Array(ch));
    this._bufLen += ch.length;
    while (this._bufLen >= this._chunkSize) {
      const out = new Float32Array(this._chunkSize);
      let offset = 0;
      while (offset < this._chunkSize && this._buf.length) {
        const piece = this._buf[0];
        const need = this._chunkSize - offset;
        if (piece.length <= need) {
          out.set(piece, offset); offset += piece.length;
          this._bufLen -= piece.length; this._buf.shift();
        } else {
          out.set(piece.subarray(0, need), offset);
          this._buf[0] = piece.subarray(need);
          this._bufLen -= need; offset += need;
        }
      }
      let sum = 0;
      for (let i = 0; i < out.length; i++) sum += out[i] * out[i];
      this.port.postMessage({ pcm: out.buffer, rms: Math.sqrt(sum / out.length) }, [out.buffer]);
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

    let workletUrl = null;
    let audioCtx = null;
    let workletNode = null;
    let sourceNode = null;
    let micStream = null;
    let ws = null;
    let activeCallback = null;  // { onSegment, onStop } for the current owner
    const clientId = Math.random().toString(36).slice(2, 10);

    function getWorkletUrl() {
        if (!workletUrl) {
            const blob = new Blob([WORKLET_SRC], { type: 'application/javascript' });
            workletUrl = URL.createObjectURL(blob);
        }
        return workletUrl;
    }

    function teardownAudio() {
        if (workletNode) { workletNode.disconnect(); workletNode = null; }
        if (sourceNode) { sourceNode.disconnect(); sourceNode = null; }
        if (audioCtx) { audioCtx.close(); audioCtx = null; }
        if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
    }

    function teardownWs() {
        if (ws) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ uid: clientId, eof: 1 }));
            }
            ws.close();
            ws = null;
        }
    }

    /**
     * Start dictating into a txtnote entity.
     * @param {object} opts
     * @param {string}   [opts.model]    - whisper model name
     * @param {string}   [opts.language] - ISO language code or null for auto
     * @param {function} opts.onSegment  - called with (text, isPartial)
     * @param {function} opts.onStop     - called when recording stops for any reason
     */
    async function start({ model = 'small', language = null, onSegment, onStop }) {
        // Stop any previous session first
        await stop();

        activeCallback = { onSegment, onStop };

        // 1. WebSocket
        await new Promise((resolve, reject) => {
            const socket = new WebSocket(whisperServerUrl);
            socket.binaryType = 'arraybuffer';
            socket.onopen = () => {
                socket.send(JSON.stringify({
                    uid: clientId,
                    language: language || null,
                    task: 'transcribe',
                    model,
                    use_vad: true,
                    audio_format: 'float32',
                }));
                resolve();
            };
            socket.onerror = (e) => reject(new Error('WebSocket error'));
            socket.onclose = () => {
                if (activeCallback?.onStop) activeCallback.onStop();
                activeCallback = null;
            };
            socket.onmessage = (ev) => {
                let data;
                try { data = JSON.parse(ev.data); } catch { return; }
                if (data.uid !== clientId) return;
                if (data.message === 'SERVER_READY') return;
                if (data.status === 'WAIT' || data.status === 'ERROR') {
                    console.warn('[WhisperDictation] server status:', data.status, data.message);
                    return;
                }
                if (Array.isArray(data.segments) && activeCallback) {
                    // Concatenate all segment texts for a flat string
                    const text = data.segments.map(s => (s.text || s).trim()).filter(Boolean).join(' ');
                    const isPartial = !data.completed;
                    activeCallback.onSegment(text, isPartial);
                }
            };
            ws = socket;
        });

        // 2. Mic + AudioWorklet
        micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1, sampleRate: { ideal: 16000 },
                echoCancellation: true, noiseSuppression: true,
            }
        });
        audioCtx = new AudioContext({ sampleRate: 16000 });
        await audioCtx.audioWorklet.addModule(getWorkletUrl());
        sourceNode = audioCtx.createMediaStreamSource(micStream);
        workletNode = new AudioWorkletNode(audioCtx, 'pcm-processor');
        workletNode.port.onmessage = ({ data: { pcm } }) => {
            if (ws && ws.readyState === WebSocket.OPEN) ws.send(pcm);
        };
        sourceNode.connect(workletNode);
        // workletNode deliberately not connected to destination (silent capture)
    }

    async function stop() {
        teardownWs();
        teardownAudio();
        // onStop is fired by ws.onclose; but if ws was never opened, call it manually
        if (activeCallback) {
            activeCallback.onStop?.();
            activeCallback = null;
        }
    }

    return { start, stop };
})();


AFRAME.registerComponent('txtnote', {
    schema: {
        id: { type: 'string' },
        title: { type: 'string' },
        content: { type: 'string', default: "Lorem ipsum dolor sit amet." },
        pos_x: { type: 'number' },
        pos_y: { type: 'number' },
        pos_z: { type: 'number' },
        rot_x: { type: 'number' },
        rot_y: { type: 'number' },
        rot_z: { type: 'number' },
        anchored: { type: 'boolean', default: true },
        qrcode_id: { type: 'string' },
        temporary: { type: 'boolean', default: false }
    },

    init: function () {
        // runs once when the component is attached to an entity
        this.el.setAttribute('mixin', 'txtnote');

        this.editBtn = document.createElement('a-entity');
        this.editBtn.setAttribute('mixin', "uiBtnEditMixin");
        this.editBtn.setAttribute('class', "collidable");
        this.el.appendChild(this.editBtn);

        this.deleteBtn = document.createElement('a-entity');
        this.deleteBtn.setAttribute('mixin', "uiBtnDeleteMixin");
        this.deleteBtn.setAttribute('class', "collidable");
        this.deleteBtn.addEventListener('click', (event) => {
            this.el.parentNode.removeChild(this.el);
        });
        this.el.appendChild(this.deleteBtn);

        // ── Dictation state ──────────────────────────────────────────────
        this._dictating = false;
        this._contentBeforeDictation = '';  // snapshot so we can prepend/replace

        this.editBtn.addEventListener('click', () => {
            if (this._dictating) {
                this._stopDictation();
            } else {
                this._startDictation();
            }
        });

        this.init = true;
        this._creating = false;
    },

    _startDictation: async function () {
        this._dictating = true;
        this._contentBeforeDictation = '';//this.data.content; We decide to overwrite everything.

        // Visual feedback: pulse the edit button red while recording
        this.editBtn.setAttribute('material', 'color', '#ff4444');
        this.editBtn.setAttribute('text', 'value', '●');

        try {
            await WhisperDictation.start({
                onSegment: (text, isPartial) => {
                    if (!this._dictating) return;
                    // Append new transcript after whatever was there before dictation started
                    const base = this._contentBeforeDictation ? this._contentBeforeDictation + ' ' : '';
                    // Use setAttribute so A-Frame's update() → text component → API save all fire normally
                    this.el.setAttribute('txtnote', 'content', base + text);
                },
                onStop: () => {
                    // Called when WS closes (server timeout, network drop, etc.)
                    this._cleanupDictationUI();
                },
            });
        } catch (err) {
            console.error('[txtnote] dictation failed to start:', err);
            this._cleanupDictationUI();
        }
    },

    _stopDictation: function () {
        WhisperDictation.stop();   // triggers onStop → _cleanupDictationUI
        this._dictating = false;
    },

    _cleanupDictationUI: function () {
        this._dictating = false;
        // Restore edit button appearance
        this.editBtn.setAttribute('material', 'color', 'green');
        this.editBtn.setAttribute('text', 'value', 'E');
    },

    remove: function () {
        if (this._dictating) this._stopDictation();
    },

    update: async function (oldData) {
        // runs when schema properties change at runtime
        const el = this.el;
        const data = this.data;

        if (this.init) {
            el.setAttribute('position', { x: data.pos_x, y: data.pos_y, z: data.pos_z });
        } else {
            const elPos = el.getAttribute('position');
            el.setAttribute('txtnote', 'pos_x', elPos.x);
            el.setAttribute('txtnote', 'pos_y', elPos.y);
            el.setAttribute('txtnote', 'pos_z', elPos.z);
        }
        // let width = Math.min(data.content.length * .05 + .25, 5);
        // console.log(width)
        el.setAttribute('text', { value: data.content });
        if (this.init && data.anchored) {
            el.setAttribute('rotation', { x: data.rot_x, y: data.rot_y, z: data.rot_z });
        } else {
            const elRot = el.getAttribute('rotation');
            el.setAttribute('txtnote', 'rot_x', elRot.x);
            el.setAttribute('txtnote', 'rot_y', elRot.y);
            el.setAttribute('txtnote', 'rot_z', elRot.z);
        }
        if (!data.anchored) {
            el.setAttribute('look-at', '#camera');
        }
        else {
            el.removeAttribute('look-at');
        }

        if (this.init) {
            this.init = false;
        }
        else if (!data.temporary) {
            if (data.id) {
                noteService.updateTextNote(data.id, AFRAME.utils.diff(oldData, data));
            } else if (!this._creating) {
                this._creating = true;
                try {
                    const newnote = await noteService.createTextNote(data);
                    this.el.setAttribute('txtnote', 'id', newnote.id);
                } catch (err) {
                    console.error('Failed to create text note:', err);
                } finally {
                    this._creating = false;
                }
            }
        }
    },

    tick: function () {
        // runs every frame — keep it light
    },

    remove: function () {
        if (this.data.id) {
            noteService.deleteNote(this.data.id);
        }
    }
});

AFRAME.registerComponent('imgnote', {
    schema: {
        id: { type: 'string' },
        title: { type: 'string' },
        image: { type: 'string' },
        pos_x: { type: 'number' },
        pos_y: { type: 'number' },
        pos_z: { type: 'number' },
        rot_x: { type: 'number' },
        rot_y: { type: 'number' },
        rot_z: { type: 'number' },
        anchored: { type: 'boolean' },
        qrcode_id: { type: 'string' }
    },

    init: function () {
        // runs once when the component is attached to an entity
        this.init = true;
    },

    update: function (oldData) {
        // runs when schema properties change at runtime
        const el = this.el;
        const data = this.data;

        el.setAttribute('position', { x: data.pos_x, y: data.pos_y, z: data.pos_z });
        el.setAttribute('src', data.image);
        if (!data.anchored) {
            el.setAttribute('look-at', '#camera');
        }
        else {
            el.removeAttribute('look-at');
            el.setAttribute('rotation', { x: data.rot_x, y: data.rot_y, z: data.rot_z })
        }

        if (this.init) {
            this.init = false;
        }
        else {
            // TODO
            //noteService.updateImageNote(data.id, AFRAME.utils.diff(oldData, data));
        }
    },

    tick: function () {
        // runs every frame — keep it light
    },

    remove: function () {
        // cleanup when component is removed
        noteService.deleteNote(this.data.id);
    }
});

/**
   * <a-entity arrow="start: x y z; end: x y z; color: #ff0000; shaftRadius: 0.02; headRadius: 0.06; headLength: 0.15">
   *
   * Builds a cylinder (shaft) + cone (head) pointing from `start` to `end`.
   * Coordinates are in the entity's local space (so you can also just move
   * the parent entity around and keep start/end relative).
   */
AFRAME.registerComponent('arrow', {
    schema: {
        start: { type: 'vec3', default: { x: 0, y: 0, z: 0 } },
        end: { type: 'vec3', default: { x: 0, y: 1, z: 0 } },
        color: { type: 'color', default: '#ffffff' },
        shaftRadius: { type: 'number', default: 0.02 },
        headRadius: { type: 'number', default: 0.06 },
        headLength: { type: 'number', default: 0.15 },
        opacity: { type: 'number', default: 1 }
    },

    init: function () {
        this.shaft = document.createElement('a-cylinder');
        this.head = document.createElement('a-cone');
        this.shaft.setAttribute('segments-radial', 12);
        this.head.setAttribute('segments-radial', 12);
        this.el.appendChild(this.shaft);
        this.el.appendChild(this.head);
    },

    update: function () {
        const data = this.data;
        const start = new THREE.Vector3(data.start.x, data.start.y, data.start.z);
        const end = new THREE.Vector3(data.end.x, data.end.y, data.end.z);

        const fullVec = new THREE.Vector3().subVectors(end, start);
        const totalLength = fullVec.length();

        if (totalLength < 1e-6) {
            // Degenerate arrow (start === end): hide geometry.
            this.shaft.setAttribute('visible', false);
            this.head.setAttribute('visible', false);
            return;
        }
        this.shaft.setAttribute('visible', true);
        this.head.setAttribute('visible', true);

        const dir = fullVec.clone().normalize();

        // Clamp head length so it never exceeds the full arrow length.
        const headLength = Math.min(data.headLength, totalLength * 0.8);
        const shaftLength = Math.max(totalLength - headLength, 0.0001);

        // Default A-Frame cylinder/cone primitives are authored pointing
        // along +Y, centered at their own origin. We rotate +Y onto `dir`.
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            dir
        );

        const shaftCenter = start.clone().addScaledVector(dir, shaftLength / 2);
        const headBase = start.clone().addScaledVector(dir, shaftLength);
        const headCenter = headBase.clone().addScaledVector(dir, headLength / 2);

        this.shaft.setAttribute('radius', data.shaftRadius);
        this.shaft.setAttribute('height', shaftLength);
        this.shaft.setAttribute('color', data.color);
        this.shaft.setAttribute('opacity', data.opacity);
        this.shaft.object3D.position.copy(shaftCenter);
        this.shaft.object3D.quaternion.copy(quaternion);

        this.head.setAttribute('radius-bottom', data.headRadius);
        this.head.setAttribute('radius-top', 0);
        this.head.setAttribute('height', headLength);
        this.head.setAttribute('color', data.color);
        this.head.setAttribute('opacity', data.opacity);
        this.head.object3D.position.copy(headCenter);
        this.head.object3D.quaternion.copy(quaternion);
    },

    remove: function () {
        if (this.shaft) this.shaft.remove();
        if (this.head) this.head.remove();
    }
});

AFRAME.registerComponent('arrnote', {
    schema: {
        id: { type: 'string' },
        title: { type: 'string' },
        pos_x: { type: 'number' },
        pos_y: { type: 'number' },
        pos_z: { type: 'number' },
        pos2_x: { type: 'number' },
        pos2_y: { type: 'number' },
        pos2_z: { type: 'number' },
        qrcode_id: { type: 'string' }
    },

    init: function () {
        // runs once when the component is attached to an entity
        this.init = true;
    },

    update: function (oldData) {
        // runs when schema properties change at runtime
        const el = this.el;
        const data = this.data;

        const pStart = new THREE.Vector3(data.pos_x, data.pos_y, data.pos_z);
        const pEnd = new THREE.Vector3(data.pos2_x, data.pos2_y, data.pos2_z);

        el.setAttribute('arrow', { start: pStart, end: pEnd, color: "red" });

        if (this.init) {
            this.init = false;
        }
        else {
            noteService.updateArrowNote(data.id, AFRAME.utils.diff(oldData, data));
        }
    },

    tick: function () {
        // runs every frame — keep it light
    },

    remove: function () {
        // cleanup when component is removed
        noteService.deleteNote(this.data.id);
    }
});


// Component to change to a sequential color on click.
AFRAME.registerComponent('custom-cursor', {
    init: function () {
        const el = this.el;

        const handEl = document.querySelector("#rightHand");
        handEl.addEventListener('pinchstarted', function () {
            el.setAttribute('color', "yellow");
        })
        handEl.addEventListener('pinchended', function () {
            el.setAttribute('color', "white");
        })
    }
});

AFRAME.registerComponent('change-color-on-click', {
    init: function () {
        const el = this.el;

        // Listen for the tap/click event
        el.addEventListener('click', function () {
            // Generate a random color hex string
            const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16);

            // Change the target entity's color attribute
            el.setAttribute('material', 'color', randomColor);
        });
    }
});


AFRAME.registerComponent('custom-ar-hit-test', {
    schema: {
        target: { type: 'selector' },
        mode: { default: 'viewer', oneOf: ['viewer', 'hand'] },
        enabled: { default: true }
    },

    init: function () {
        this.hitTestSource = null;
        this.transientHitTestSource = null; // separate source for phone tap
        this.active = false;
        this.laserEl = null;
        this._lastPose = null;
        this._activeSource = null;

        var self = this;
        var renderer = this.el.sceneEl.renderer;

        renderer.xr.addEventListener('sessionstart', function () {
            // Removed is('ar-mode') check — it's false at this point due to async timing
            self._session = renderer.xr.getSession();
            self._setupHitTestSource();
            self._setupLaser();
            self._session.addEventListener('selectstart', self._onSelectStart.bind(self));
            self._session.addEventListener('selectend', self._onSelectEnd.bind(self));
        });

        renderer.xr.addEventListener('sessionend', function () {
            self.hitTestSource = null;
            self.transientHitTestSource = null;
            self.active = false;
            self._session = null;
            self._lastPose = null;
            if (self.laserEl) {
                self.laserEl.parentNode.removeChild(self.laserEl);
                self.laserEl = null;
            }
        });
    },

    _setupHitTestSource: function () {
        var self = this;
        var session = this._session;

        if (this.data.mode === 'viewer') {
            // Phone: use transient input hit-test so the ray follows the tap point,
            // not the screen center. This mirrors exactly what A-Frame's original does.
            session.requestHitTestSourceForTransientInput({ profile: 'generic-touchscreen' })
                .then(function (src) {
                    self.transientHitTestSource = src;
                    console.log('custom-ar-hit-test: transient source ready');
                })
                .catch(function (e) { console.warn('transient hit-test source failed:', e); });

        } else {
            // ML2 hand: stable hardware-fused ray from the hand's targetRaySpace
            var onSourcesChange = function () {
                var sources = session.inputSources;
                for (var i = 0; i < sources.length; i++) {
                    if (sources[i].hand) {
                        session.requestHitTestSource({ space: sources[i].targetRaySpace })
                            .then(function (src) {
                                self.hitTestSource = src;
                                console.log('custom-ar-hit-test: hand source ready');
                            })
                            .catch(function (e) { console.warn('hand hit-test source failed:', e); });
                        session.removeEventListener('inputsourceschange', onSourcesChange);
                        return;
                    }
                }
            };
            session.addEventListener('inputsourceschange', onSourcesChange);
            onSourcesChange();
        }
    },

    _setupLaser: function () {
        if (this.data.mode !== 'hand') return;
        this.laserEl = document.createElement('a-cylinder');
        this.laserEl.setAttribute('radius', '0.003');
        this.laserEl.setAttribute('height', '1');
        this.laserEl.setAttribute('segments-height', '1');
        this.laserEl.setAttribute('segments-radial', '6');
        this.laserEl.setAttribute('material', 'color: #a29bfe; emissive: #a29bfe; emissiveIntensity: 1; opacity: 0.8; transparent: true; depthWrite: false');
        this.laserEl.setAttribute('visible', 'false');
        this.el.sceneEl.appendChild(this.laserEl);
    },

    _onSelectStart: function (e) {
        if (!this.data.enabled) return;
        var src = e.inputSource;
        if (this.data.mode === 'viewer') {
            if (src.targetRayMode !== 'transient-pointer' && src.targetRayMode !== 'screen') return;
        } else {
            if (!src.hand) return;
        }
        this.active = true;
        this._activeSource = src;
    },

    _onSelectEnd: function (e) {
        if (!this.active) return;
        // For transient/screen inputs the inputSource reference may differ between
        // selectstart and selectend, so only check mode rather than object identity
        var src = e.inputSource;
        if (this.data.mode === 'viewer') {
            if (src.targetRayMode !== 'transient-pointer' && src.targetRayMode !== 'screen') return;
        } else {
            if (!src.hand) return;
        }
        if (this._lastPose && this.data.target) {
            var obj = this.data.target.object3D;
            obj.position.copy(this._lastPose.transform.position);
            obj.quaternion.copy(this._lastPose.transform.orientation);
            obj.visible = true;
            this.el.sceneEl.emit('ar-hit-test-select', {
                position: this._lastPose.transform.position,
                orientation: this._lastPose.transform.orientation
            });
        }

        this.active = false;
        this._activeSource = null;
    },

    tick: function () {
        if (!this.data.enabled) return;
        var frame = this.el.sceneEl.frame;
        if (!frame) return;

        var renderer = this.el.sceneEl.renderer;
        var refSpace = renderer.xr.getReferenceSpace();

        if (this.data.mode === 'viewer') {
            // Transient: results only exist during an active touch
            if (!this.transientHitTestSource) return;
            var transientResults = frame.getHitTestResultsForTransientInput(this.transientHitTestSource);
            if (transientResults.length > 0 && transientResults[0].results.length > 0) {
                this._lastPose = transientResults[0].results[0].getPose(refSpace);
            }
            // Note: _lastPose intentionally kept from last frame so selectend can use it
            // even after the touch lifts and transient results disappear.

        } else {
            // Hand: continuous ray, always updating
            if (!this.hitTestSource) return;
            var results = frame.getHitTestResults(this.hitTestSource);
            if (results.length === 0) {
                if (this.laserEl) this.laserEl.setAttribute('visible', 'false');
                return;
            }
            this._lastPose = results[0].getPose(refSpace);
            if (!this._lastPose) return;

            // Move cursor to hit point
            if (this.data.target) {
                var obj = this.data.target.object3D;
                obj.position.copy(this._lastPose.transform.position);
                obj.quaternion.copy(this._lastPose.transform.orientation);
            }

            // Update laser from hand to hit point
            if (this.laserEl) {
                var session = renderer.xr.getSession();
                if (!session) return;
                var sources = session.inputSources;
                for (var i = 0; i < sources.length; i++) {
                    if (!sources[i].hand) continue;
                    var handPose = frame.getPose(sources[i].targetRaySpace, refSpace);
                    if (!handPose) continue;
                    var origin = new THREE.Vector3().copy(handPose.transform.position);
                    var hitPt = new THREE.Vector3().copy(this._lastPose.transform.position);
                    var dist = origin.distanceTo(hitPt);
                    var dir = hitPt.clone().sub(origin).normalize();
                    var quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
                    this.laserEl.object3D.position.copy(origin.clone().lerp(hitPt, 0.5));
                    this.laserEl.object3D.quaternion.copy(quat);
                    this.laserEl.object3D.scale.set(1, dist, 1);  // scale instead of setAttribute for perf
                    this.laserEl.setAttribute('visible', 'true');
                    break;
                }
            }
        }
    },

    remove: function () {
        if (this.hitTestSource) this.hitTestSource.cancel();
        if (this.transientHitTestSource) this.transientHitTestSource.cancel();
        if (this.laserEl && this.laserEl.parentNode) {
            this.laserEl.parentNode.removeChild(this.laserEl);
        }
    }
});

// DEBUG: log every XR session event to see what's actually firing
AFRAME.registerComponent('xr-debug', {
    init: function () {
        var sceneEl = this.el.sceneEl || this.el;
        var renderer = sceneEl.renderer;

        sceneEl.addEventListener('enter-vr', function () {
            console.log('[xr-debug] enter-vr fired');
        });

        renderer.xr.addEventListener('sessionstart', function () {
            console.log('[xr-debug] sessionstart fired, isAR:', sceneEl.is('ar-mode'));
            var session = renderer.xr.getSession();
            console.log('[xr-debug] session:', session);
            console.log('[xr-debug] requestHitTestSourceForTransientInput available:',
                typeof session.requestHitTestSourceForTransientInput);
            console.log('[xr-debug] requestHitTestSource available:',
                typeof session.requestHitTestSource);

            session.addEventListener('selectstart', function (e) {
                console.log('[xr-debug] selectstart:', e.inputSource.targetRayMode, e.inputSource.profiles);
            });
            session.addEventListener('selectend', function (e) {
                console.log('[xr-debug] selectend:', e.inputSource.targetRayMode);
            });
        });
    }
});