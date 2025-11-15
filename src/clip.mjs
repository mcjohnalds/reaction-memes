import {
  CLIPTextModelWithProjection,
  AutoTokenizer,
  CLIPVisionModelWithProjection,
  AutoProcessor,
  RawImage,
} from "@huggingface/transformers";

const textModel = await CLIPTextModelWithProjection.from_pretrained(
  "Xenova/clip-vit-base-patch32",
  { dtype: "fp32" },
);
const visionModel = await CLIPVisionModelWithProjection.from_pretrained(
  "Xenova/clip-vit-base-patch32",
  { dtype: "fp32" },
);
const tokenizer = await AutoTokenizer.from_pretrained(
  "Xenova/clip-vit-base-patch32",
  { dtype: "fp32" },
);
const processor = await AutoProcessor.from_pretrained(
  "Xenova/clip-vit-base-patch32",
  { dtype: "fp32" },
);

export async function encodeText(text) {
  const inputs = await tokenizer(text);
  const output = await textModel(inputs);
  return Array.from(output.text_embeds.normalize().data);
}

export async function encodeImage(imagePath) {
  const image = await RawImage.read(imagePath);
  const inputs = await processor(image);
  const output = await visionModel(inputs);
  return Array.from(output.image_embeds.normalize().data);
}
