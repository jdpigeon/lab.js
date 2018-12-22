import { transform, pickBy } from 'lodash'
import { getLocalFile } from '../../../../../logic/util/files'

const defaults = {
  left: 0, top: 0,
  width: 50, height: 50,
  angle: 0,
  stroke: null, fill: 'black'
}

// TODO: This is a mess :-/
export const filePlaceholderRegex =
  /^\s*\${\s*this\.files\[['"]([^'"]+)['"]\]\s*}\s*$/

// TODO: Add proper validation mechanism
// and alert user to nonsensical values
const toNumber = (s, fallback=0) => {
  if (['', '+', '-'].includes(s)) {
    return 0
  } else {
    return Number(s) || fallback
  }
}

const isPlaceholder = o =>
  typeof o === 'string' && o.includes('$')

const unprocessedOptions = ['text', 'src']

export const toCanvas = (object, { store, id }) => {
  if (!object) {
    return object
  } else {
    const output = {
      ...object,
      // Substitute defaults where placeholders are used
      // (except for text content which is passed through,
      // and image srcs, which are handled below)
      ...transform(object, (result, v, k) => {
        if (isPlaceholder(v) && !unprocessedOptions.includes(k)) {
          result[k] = defaults[k]
        } else if (['left', 'top', 'angle', 'width', 'height'].includes(k)) {
          result[k] = toNumber(
            object[k], defaults[k], // fallback values
          )
        }
      }),
      // Lock manipulations where placeholders are present
      lockMovementX: isPlaceholder(object.left),
      lockMovementY: isPlaceholder(object.top),
      lockScalingX: isPlaceholder(object.width),
      lockScalingY: isPlaceholder(object.height) || object.type === 'line',
      lockRotation: isPlaceholder(object.angle),
    }

    if (object.type === 'circle') {
      output.radius = output.width / 2
    } else if (output.type === 'ellipse') {
      output.rx = output.width / 2
      output.ry = output.height / 2
    } else if (output.type === 'line') {
      output.x1 = output.left - output.width / 2
      output.x2 = output.left + output.width / 2
      output.y1 = output.top
      output.y2 = output.top
    } else if (output.type === 'image') {
      output.scaleX = output.width / output.naturalWidth
      output.scaleY = output.height / output.naturalHeight
      output.width = output.naturalWidth
      output.height = output.naturalHeight

      // Look up and insert image data
      const filePlaceholderMatch = output.src.match(filePlaceholderRegex)
      if (filePlaceholderMatch) {
        const imagePath = filePlaceholderMatch[1]
        output.src = getLocalFile(store, id, imagePath).content
      }
    }

    return output
  }
}

export const fromCanvas = (object, oldObject) => {
  if (!object) {
    return object
  }

  const output = {
    // Filter manipulation locks
    ...pickBy(object, (v, k) => !k.startsWith('lock')),
    // Placeholders can't be overridden
    ...transform(object, (result, v, k) => {
      if (isPlaceholder(oldObject[k]) && k !== 'text') {
        result[k] = oldObject[k]
      }
    }),
  }

  if (object.type === 'image') {
    output.width = output.scaleX * output.naturalWidth
    output.height = output.scaleY * output.naturalHeight
  }

  return output
}
