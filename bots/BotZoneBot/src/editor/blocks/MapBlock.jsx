import React from 'react'
import Icon from '../../components/Icon.jsx'
import { useDocument } from '../../store/DocumentContext.jsx'

export default function MapBlock({ block }) {
  const { updateBlock } = useDocument()
  const set = (patch) => updateBlock(block.id, patch)

  return (
    <div className="map-block">
      <div className="preview">
        <Icon name="map" size={16} />
        {block.latitude && block.longitude ? `${block.latitude}, ${block.longitude}` : 'Enter coordinates below'}
      </div>
      <div className="grid">
        <input
          placeholder="Latitude"
          inputMode="decimal"
          value={block.latitude}
          onChange={(e) => set({ latitude: e.target.value })}
        />
        <input
          placeholder="Longitude"
          inputMode="decimal"
          value={block.longitude}
          onChange={(e) => set({ longitude: e.target.value })}
        />
        <input
          placeholder="Zoom (0-24)"
          type="number"
          min={0}
          max={24}
          value={block.zoom}
          onChange={(e) => set({ zoom: e.target.value })}
        />
        <input
          placeholder="Width"
          type="number"
          value={block.width}
          onChange={(e) => set({ width: e.target.value })}
        />
        <input
          placeholder="Height"
          type="number"
          value={block.height}
          onChange={(e) => set({ height: e.target.value })}
        />
      </div>
      <input
        className="media-caption-input"
        placeholder="Caption (optional)"
        value={block.caption}
        onChange={(e) => set({ caption: e.target.value })}
      />
    </div>
  )
}
