export interface CastLook {
  shirt: string;
  pants: string;
  skin: string;
  hair: string;
  headwear?: string;
}

export const CAST_LOOKS: Record<string, CastLook> = {
  michel: { shirt: '#f2a71b', pants: '#2b3450', skin: '#5b3a29', hair: '#1c1c1c' },
  sandra: { shirt: '#2e57c4', pants: '#2f333c', skin: '#7a4a2f', hair: '#1c1c1c' },
  pauline: { shirt: '#21857c', pants: '#21857c', skin: '#8d5a3a', hair: '#1c1c1c', headwear: '#21857c' },
  serge: { shirt: '#7d2e4d', pants: '#33363c', skin: '#6b4327', hair: '#1c1c1c' },
  esther: { shirt: '#2e51d6', pants: '#2e51d6', skin: '#5b3a29', hair: '#1c1c1c' },
  jean_claude: { shirt: '#7d2434', pants: '#565c66', skin: '#6b4327', hair: '#9a9a94' },
};

export const CAST_NPC_IDS = Object.keys(CAST_LOOKS);

export const CAST_REFERENCE_IMAGES: Record<string, string> = {
  michel: 'michel_moto_taxi_driver.png',
  sandra: 'sandra_graduate_applicant.png',
  pauline: 'pauline_nurse.png',
  serge: 'serge_musician.png',
  esther: 'esther_footballer.png',
  jean_claude: 'jean_claude_teacher_parent.png',
};
