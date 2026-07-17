import {
  CLIPTextModelWithProjection,
  AutoTokenizer,
  CLIPVisionModelWithProjection,
  AutoProcessor,
  RawImage,
} from "@huggingface/transformers";

const model = "Xenova/clip-vit-base-patch32";

const textModel = await CLIPTextModelWithProjection.from_pretrained(model, {
  dtype: "fp32",
});
const tokenizer = await AutoTokenizer.from_pretrained(model, { dtype: "fp32" });

// Load the vision encoder lazily. Only the meme-generation script uses it, and
// it costs ~1GB of memory we do not want resident in the web server.
let visionModel;
let processor;

export async function encodeText(text) {
  const inputs = await tokenizer(text);
  const output = await textModel(inputs);
  return Array.from(output.text_embeds.normalize().data);
}

export async function encodeImage(imagePath) {
  visionModel ??= await CLIPVisionModelWithProjection.from_pretrained(model, {
    dtype: "fp32",
  });
  processor ??= await AutoProcessor.from_pretrained(model, { dtype: "fp32" });
  const image = await RawImage.read(imagePath);
  const inputs = await processor(image);
  const output = await visionModel(inputs);
  return Array.from(output.image_embeds.normalize().data);
}
