"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Avatar from "boring-avatars"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Switch } from "@/components/ui/switch"
import { RefreshCw, Palette, Sparkles, ChevronDown, Check, Square, Circle, RotateCcw } from "lucide-react"
import type { LogoConfig } from "@/lib/types"

interface LogoGeneratorProps {
  extensionName: string
  suggestedLogo?: LogoConfig
  onLogoGenerated?: (dataUrl: string) => void
}

const variants = ["marble", "beam", "pixel", "sunset", "ring", "bauhaus"] as const
type Variant = (typeof variants)[number]

export const colorPalettes = [
  { name: "VS Code", colors: ["#007ACC", "#1E1E1E", "#569CD6", "#4EC9B0", "#CE9178"] },
  { name: "Ocean", colors: ["#264653", "#2A9D8F", "#E9C46A", "#F4A261", "#E76F51"] },
  { name: "Sunset", colors: ["#F72585", "#B5179E", "#7209B7", "#560BAD", "#480CA8"] },
  { name: "Forest", colors: ["#2D6A4F", "#40916C", "#52B788", "#74C69D", "#95D5B2"] },
  { name: "Candy", colors: ["#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3", "#F38181"] },
  { name: "Mono", colors: ["#212529", "#343A40", "#495057", "#6C757D", "#ADB5BD"] },
  { name: "Neon", colors: ["#00F5D4", "#00BBF9", "#FEE440", "#F15BB5", "#9B5DE5"] },
  { name: "Earth", colors: ["#8B4513", "#A0522D", "#CD853F", "#DEB887", "#F5DEB3"] },
  { name: "Dracula", colors: ["#282A36", "#44475A", "#6272A4", "#BD93F9", "#FF79C6"] },
  { name: "Nord", colors: ["#2E3440", "#3B4252", "#88C0D0", "#81A1C1", "#5E81AC"] },
  { name: "Monokai", colors: ["#272822", "#F92672", "#A6E22E", "#FD971F", "#66D9EF"] },
  { name: "Solarized", colors: ["#002B36", "#073642", "#268BD2", "#2AA198", "#859900"] },
]

export function LogoGenerator({ extensionName, suggestedLogo, onLogoGenerated }: LogoGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [variant, setVariant] = useState<Variant>(suggestedLogo?.variant || "marble")
  const [size, setSize] = useState(128)
  const [selectedPalette, setSelectedPalette] = useState(suggestedLogo?.palette || 0)
  const [customSeed, setCustomSeed] = useState(suggestedLogo?.seed || "")
  const [hasGenerated, setHasGenerated] = useState(false)
  const [isSquare, setIsSquare] = useState(true)
  const [backgroundColor, setBackgroundColor] = useState("#transparent")
  const [useBackground, setUseBackground] = useState(false)
  const [borderRadius, setBorderRadius] = useState(0)
  const [customColors, setCustomColors] = useState<string[]>([])
  const [useCustomColors, setUseCustomColors] = useState(false)
  const svgContainerRef = useRef<HTMLDivElement>(null)

  const seed = customSeed || extensionName || "my-extension"
  const colors = useCustomColors && customColors.length >= 2 ? customColors : colorPalettes[selectedPalette].colors

  useEffect(() => {
    if (suggestedLogo) {
      setVariant(suggestedLogo.variant)
      setSelectedPalette(suggestedLogo.palette)
      if (suggestedLogo.seed) setCustomSeed(suggestedLogo.seed)
    }
  }, [suggestedLogo])

  const generateLogo = useCallback(() => {
    if (!svgContainerRef.current) return

    const svgElement = svgContainerRef.current.querySelector("svg")
    if (!svgElement) return

    const clonedSvg = svgElement.cloneNode(true) as SVGElement
    clonedSvg.setAttribute("width", "128")
    clonedSvg.setAttribute("height", "128")

    const svgData = new XMLSerializer().serializeToString(clonedSvg)
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" })
    const svgUrl = URL.createObjectURL(svgBlob)

    const img = new Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = 128
      canvas.height = 128
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      if (useBackground && backgroundColor !== "#transparent") {
        ctx.fillStyle = backgroundColor
        if (borderRadius > 0) {
          ctx.beginPath()
          ctx.roundRect(0, 0, 128, 128, borderRadius)
          ctx.fill()
        } else {
          ctx.fillRect(0, 0, 128, 128)
        }
      }

      // Apply border radius clipping for the icon
      if (borderRadius > 0 && !isSquare) {
        ctx.beginPath()
        ctx.arc(64, 64, 64, 0, Math.PI * 2)
        ctx.clip()
      } else if (borderRadius > 0) {
        ctx.beginPath()
        ctx.roundRect(0, 0, 128, 128, borderRadius)
        ctx.clip()
      }

      ctx.drawImage(img, 0, 0, 128, 128)
      const dataUrl = canvas.toDataURL("image/png")
      onLogoGenerated?.(dataUrl)
      setHasGenerated(true)
      URL.revokeObjectURL(svgUrl)
    }

    img.src = svgUrl
  }, [onLogoGenerated, useBackground, backgroundColor, borderRadius, isSquare])

  useEffect(() => {
    const timer = setTimeout(() => {
      generateLogo()
    }, 100)
    return () => clearTimeout(timer)
  }, [
    variant,
    selectedPalette,
    seed,
    generateLogo,
    isSquare,
    useBackground,
    backgroundColor,
    borderRadius,
    customColors,
    useCustomColors,
  ])

  const randomizeSeed = () => {
    setCustomSeed(Math.random().toString(36).substring(2, 10))
  }

  const resetToDefaults = () => {
    setVariant("marble")
    setSelectedPalette(0)
    setCustomSeed("")
    setIsSquare(true)
    setUseBackground(false)
    setBackgroundColor("#transparent")
    setBorderRadius(0)
    setUseCustomColors(false)
    setCustomColors([])
  }

  const updateCustomColor = (index: number, color: string) => {
    const newColors = [...customColors]
    newColors[index] = color
    setCustomColors(newColors)
  }

  const addCustomColor = () => {
    if (customColors.length < 5) {
      setCustomColors([...customColors, "#007ACC"])
    }
  }

  const removeCustomColor = (index: number) => {
    setCustomColors(customColors.filter((_, i) => i !== index))
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Extension Icon
                {hasGenerated && (
                  <span className="flex items-center gap-1 text-xs text-green-500 font-normal">
                    <Check className="w-3 h-3" />
                    Auto-generated
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {/* Preview thumbnail */}
                <div
                  className="w-8 h-8 overflow-hidden border border-border"
                  style={{ borderRadius: isSquare ? borderRadius / 4 : "50%" }}
                >
                  <Avatar name={seed} variant={variant} size={32} colors={colors} square={isSquare} />
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Preview */}
            <div className="flex justify-center p-4 bg-muted/50 rounded-lg">
              <div
                ref={svgContainerRef}
                className="overflow-hidden shadow-lg"
                style={{
                  width: size,
                  height: size,
                  borderRadius: isSquare ? borderRadius : "50%",
                  backgroundColor: useBackground ? backgroundColor : "transparent",
                }}
              >
                <Avatar name={seed} variant={variant} size={size} colors={colors} square={isSquare} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-2">
                {isSquare ? <Square className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                Shape
              </Label>
              <div className="flex gap-2">
                <Button
                  variant={isSquare ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setIsSquare(true)}
                >
                  <Square className="w-3 h-3 mr-1" />
                  Square
                </Button>
                <Button
                  variant={!isSquare ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setIsSquare(false)}
                >
                  <Circle className="w-3 h-3 mr-1" />
                  Circle
                </Button>
              </div>
            </div>

            {/* Variant selector */}
            <div className="space-y-2">
              <Label className="text-xs">Style</Label>
              <div className="grid grid-cols-3 gap-2">
                {variants.map((v) => (
                  <button
                    key={v}
                    onClick={() => setVariant(v)}
                    className={`p-2 rounded-md text-xs font-medium transition-colors ${
                      variant === v
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Color palette selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1">
                  <Palette className="w-3 h-3" />
                  Color Palette
                </Label>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Custom</Label>
                  <Switch checked={useCustomColors} onCheckedChange={setUseCustomColors} className="scale-75" />
                </div>
              </div>

              {!useCustomColors ? (
                <div className="grid grid-cols-4 gap-2">
                  {colorPalettes.map((palette, idx) => (
                    <button
                      key={palette.name}
                      onClick={() => setSelectedPalette(idx)}
                      className={`p-1 rounded-md transition-all ${
                        selectedPalette === idx ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                      }`}
                      title={palette.name}
                    >
                      <div className="flex h-4 rounded overflow-hidden">
                        {palette.colors.map((color, i) => (
                          <div key={i} className="flex-1" style={{ backgroundColor: color }} />
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">{palette.name}</p>
                    </button>
                  ))}
                </div>
              ) : (
                /* Custom color picker */
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {customColors.map((color, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => updateCustomColor(idx, e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border-0"
                        />
                        <button
                          onClick={() => removeCustomColor(idx)}
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {customColors.length < 5 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs bg-transparent"
                        onClick={addCustomColor}
                      >
                        + Add Color
                      </Button>
                    )}
                  </div>
                  {customColors.length < 2 && <p className="text-xs text-amber-500">Add at least 2 colors</p>}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Background</Label>
                <Switch checked={useBackground} onCheckedChange={setUseBackground} className="scale-75" />
              </div>
              {useBackground && (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={backgroundColor === "#transparent" ? "#ffffff" : backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0"
                  />
                  <Input
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    placeholder="#ffffff"
                    className="flex-1 h-8 text-sm font-mono"
                  />
                </div>
              )}
            </div>

            {isSquare && (
              <div className="space-y-2">
                <Label className="text-xs">Corner Radius: {borderRadius}px</Label>
                <Slider
                  value={[borderRadius]}
                  onValueChange={([v]) => setBorderRadius(v)}
                  min={0}
                  max={64}
                  step={4}
                  className="w-full"
                />
              </div>
            )}

            {/* Size slider */}
            <div className="space-y-2">
              <Label className="text-xs">Preview Size: {size}px</Label>
              <Slider
                value={[size]}
                onValueChange={([v]) => setSize(v)}
                min={64}
                max={256}
                step={8}
                className="w-full"
              />
            </div>

            {/* Custom seed */}
            <div className="space-y-2">
              <Label className="text-xs">Custom Seed</Label>
              <div className="flex gap-2">
                <Input
                  value={customSeed}
                  onChange={(e) => setCustomSeed(e.target.value)}
                  placeholder={extensionName || "extension-name"}
                  className="flex-1 h-8 text-sm"
                />
                <Button variant="outline" size="sm" onClick={randomizeSeed} className="h-8 px-2 bg-transparent">
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={resetToDefaults}
                className="h-7 px-2 text-xs text-muted-foreground"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset to Defaults
              </Button>
              <p className="text-xs text-muted-foreground">Auto-included on publish</p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
